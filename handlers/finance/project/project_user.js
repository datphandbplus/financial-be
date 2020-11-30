const Q = require( 'q' );
const _ = require( 'underscore' );
const Sequelize = require( 'sequelize' );

const ProjectRepository = require( '@models/finance/project/project_repository' );
const ProjectApproverRepository = require( '@models/finance/project/project_approver_repository' );
const PurchaseOrderApproverRepository = require( '@models/finance/project/purchase_order_approver_repository' );
const UserRepository = require( '@models/finance/user/user_repository' );

const { Logger, Account, Model } = require( '@helpers' );
const { CONSTANTS } = require( '@resources' );

const Op = Sequelize.Op;

class ProjectUserHandler {

	/**
	* @constructor
	* @param {string} channelId
	* @param {object} userData
	*/
	constructor( channelId, userData = null ) {
		this.channelId = channelId;
		this.currentUser = userData;
		this.account = new Account( userData );
	}

	/**
	* Handle change project user
	* @param {int} id - Project id
	* @param {object} data - Project data
	* @return {promise}
	*/
	async handleChange( id, data ) {
		const deferred = Q.defer();

		try {
			const project = await this._getProject( id );

			if ( !project ) {
				deferred.resolve({
					status: false,
					message: 'PROJECT_NOT_FOUND',
				});
				return deferred.promise;
			}

			const updateData = {};
			const changeRole = {
				pm	: false,
				sale: false,
			};

			// Change PM
			const manageBy = +data.manage_by;
			if ( manageBy !== project.manage_by ) {
				const user = await this._getUser( manageBy, 'PM' );

				if ( !user ) {
					deferred.resolve({
						status: false,
						message: 'USER_NOT_FOUND',
					});
					return deferred.promise;
				}

				updateData.manage_by = manageBy;
				changeRole.pm = true;
			}

			// Change SALE
			const saleBy = +data.sale_by;
			if ( saleBy !== project.sale_by ) {
				const user = await this._getUser( saleBy, 'SALE' );

				if ( !user ) {
					deferred.resolve({
						status: false,
						message: 'USER_NOT_FOUND',
					});
					return deferred.promise;
				}

				updateData.sale_by = saleBy;
				changeRole.sale = true;
			}

			// Change QS
			const qsBy = +data.qs_by;
			if ( qsBy !== project.qs_by ) {
				const user = await this._getUser( qsBy, 'QS' );

				if ( !user ) {
					deferred.resolve({
						status: false,
						message: 'USER_NOT_FOUND',
					});
					return deferred.promise;
				}

				updateData.qs_by = qsBy;
			}

			// Change PURCHASING
			const purchaseBy = +data.purchase_by;
			if ( purchaseBy !== project.purchase_by ) {
				const user = await this._getUser( purchaseBy, 'PURCHASING' );

				if ( !user ) {
					deferred.resolve({
						status: false,
						message: 'USER_NOT_FOUND',
					});
					return deferred.promise;
				}

				updateData.purchase_by = purchaseBy;
			}

			// Change CONSTRUCTION
			const constructBy = +data.construct_by;
			if ( constructBy !== +project.construct_by ) {
				if ( constructBy ) {
					const user = await this._getUser( constructBy, 'CONSTRUCTION' );

					if ( !user ) {
						deferred.resolve({
							status: false,
							message: 'USER_NOT_FOUND',
						});
						return deferred.promise;
					}

					updateData.construct_by = constructBy;
				} else {
					updateData.construct_by = null;
				}
			}

			// No update
			if ( !_.keys( updateData ).length ) {
				deferred.resolve({
					status: true,
					message: 'NOTHING_CHANGE',
				});

				return deferred.promise;
			}

			const transaction = await new Model( this.channelId ).transaction();
			const updateOptions = {
				where: { id },
				transaction,
			};
			const result = await new ProjectRepository( this.channelId ).update(
				updateData,
				updateOptions
			);

			if ( !result || !result.status ) {
				// Rollback transaction
				await transaction.rollback();

				deferred.resolve({
					status: false,
					message: 'UPDATE_PROJECT_FAIL',
				});

				return deferred.promise;
			}

			// Check project approver is change
			const funcs = [];
			if ( project.quotation_status !== CONSTANTS.QUOTATION_STATUS.APPROVED ) {
				if ( changeRole.pm ) {
					funcs.push( this._changeProjectApprover( project, updateData.manage_by, project.manage_by, transaction ) );
				}

				if ( changeRole.sale ) {
					funcs.push( this._changeProjectApprover( project, updateData.sale_by, project.sale_by, transaction ) );
				}
			} else {
				// Check PO approver is change
				const poApprover = await new PurchaseOrderApproverRepository( this.channelId )
				.getAll({
					attributes: [ 'id' ],
					where: {
						user_id	: project.manage_by,
						role_key: 'PM',
						status	: { [ Op.ne ]: CONSTANTS.PURCHASE_ORDER_APPROVE_STATUS.APPROVED },
					},
					transaction,
				});

				if ( poApprover && poApprover.length ) {
					funcs.push( this._changePOApprover( updateData.manage_by, project.manage_by, transaction ) );
				}
			}

			if ( funcs.length ) {
				const approversResult = await Q.all( funcs );

				if ( !approversResult || _.findWhere( approversResult, { status: false } ) ) {
					// Rollback transaction
					await transaction.rollback();

					deferred.resolve({
						status	: false,
						message	: 'UPDATE_PROJECT_APPROVER_FAIL',
					});
					return deferred.promise;
				}
			}

			// Commit transaction
			await transaction.commit();

			deferred.resolve( result );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle change project approver
	* @param {object} project - Project
	* @param {int} userId - User id to change
	* @param {int} oldUserId - User id to change
	* @param {any} transaction - Transaction to commit/rollback
	* @return {promise}
	*/
	async _changeProjectApprover( project, userId, oldUserId, transaction ) {
		const deferred = Q.defer();

		try {
			const projectApprover = await new ProjectApproverRepository( this.channelId ).update(
				{
					user_id: userId,
					status: project.quotation_status === CONSTANTS.QUOTATION_STATUS.WAITING_APPROVAL
						? CONSTANTS.QUOTATION_STATUS.WAITING_APPROVAL
						: CONSTANTS.QUOTATION_STATUS.PROCESSING,
					comment: null,
				},
				{
					where: {
						project_id	: project.id,
						user_id		: oldUserId,
					},
					transaction,
				}
			);

			if ( !projectApprover || !projectApprover.status ) {
				deferred.resolve({
					status: false,
					message: 'UPDATE_PROJECT_FAIL',
				});

				return deferred.promise;
			}

			deferred.resolve({
				status: true,
				message: 'UPDATE_PROJECT_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle change project purchase order approver
	* @param {int} userId - User id to change
	* @param {int} oldUserId - User id to change
	* @param {any} transaction - Transaction to commit/rollback
	* @return {promise}
	*/
	async _changePOApprover( userId, oldUserId, transaction ) {
		const deferred = Q.defer();

		try {
			const poApprover = await new PurchaseOrderApproverRepository( this.channelId ).update(
				{
					user_id		: userId,
					status		: CONSTANTS.PURCHASE_ORDER_APPROVE_STATUS.WAITING_APPROVAL,
					comment		: null,
					approved_at	: null,
				},
				{
					where: {
						user_id	: oldUserId,
						status	: { [ Op.ne ]: CONSTANTS.PURCHASE_ORDER_APPROVE_STATUS.APPROVED },
					},
					transaction,
				}
			);

			if ( !poApprover || !poApprover.status ) {
				deferred.resolve({
					status: false,
					message: 'UPDATE_PROJECT_FAIL',
				});

				return deferred.promise;
			}

			deferred.resolve({
				status: true,
				message: 'UPDATE_PROJECT_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle get project
	* @param {int} id - Project id
	* @return {promise}
	*/
	_getProject( id ) {
		const options = {
			attributes: [
				'id', 'quotation_status', 'project_status',
				'manage_by', 'sale_by', 'qs_by',
				'purchase_by', 'construct_by',
			],
			where: { id },
		};

		return new ProjectRepository( this.channelId ).getOne( options );
	}

	/**
	* Handle get user
	* @param {int} id - User id
	* @param {string} role - User role
	* @return {promise}
	*/
	_getUser( id, role ) {
		return new UserRepository( this.channelId ).getOne({
			attributes: [ 'id' ],
			where: {
				id,
				role_key	: role,
				is_disabled	: false,
			},
		});
	}

}

module.exports = ProjectUserHandler;
