const Q = require( 'q' );
const _ = require( 'underscore' );
const Sequelize = require( 'sequelize' );

const ProjectVORepository = require( '@models/finance/project/project_vo_repository' );
const ProjectLineItem = require( '@models/finance/project/project_line_item' );
const ProjectLineCost = require( '@models/finance/project/project_cost_item' );
const ProjectLineItemRepository = require( '@models/finance/project/project_line_item_repository' );
const ProjectCostItemRepository = require( '@models/finance/project/project_cost_item_repository' );
const VOApproverRepository = require( '@models/finance/project/vo_approver_repository' );
const Project = require( '@models/finance/project/project' );
const ProjectRepository = require( '@models/finance/project/project_repository' );
const VOApprover = require( '@models/finance/project/vo_approver' );
const User = require( '@models/finance/user/user' );
const ProjectLineUtility = require( '@models/finance/project/project_line_utility' );
const ProjectBillRepository = require( '@models/finance/project/project_bill_repository' );
const VOUtility = require( '@models/finance/project/vo_utility' );

const { Logger, Account, Model } = require( '@helpers' );
const { CONSTANTS } = require( '@resources' );
const Op = Sequelize.Op;

class ProjectVOHandler {

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
	* Handle get project vos
	* @param {string} queryOptions
	* @return {promise}
	*/
	async handleGetAll( queryOptions ) {
		const deferred = Q.defer();

		try {
			const options = {};

			if ( this.account.isConstruction() || this.account.isConstructionManager() ) {
				options.attributes = [
					'id', 'project_id', 'name',
					'status', 'note', 'created_at',
				];
			}

			if ( queryOptions && queryOptions.query_for === 'project' ) {
				options.where = { project_id: +queryOptions.project_id };
				options.include = [
					{
						model: await ProjectLineItem( this.channelId ),
						as: 'add_by',
					},
					{
						model: await ProjectLineItem( this.channelId ),
						as: 'delete_by',
					},
					{
						model: await ProjectLineCost( this.channelId ),
						as: 'add_cost_by',
					},
					{
						model: await ProjectLineCost( this.channelId ),
						as: 'delete_cost_by',
					},
				];

				return new ProjectVORepository( this.channelId ).getAll( options );
			}

			if ( queryOptions && queryOptions.query_for === 'project_vo_approved' ) {
				options.where = {
					project_id: +queryOptions.project_id,
					status: CONSTANTS.PROJECT_VO_STATUS.APPROVED,
				};

				return new ProjectVORepository( this.channelId ).getAll( options );
			}

			return new ProjectVORepository( this.channelId ).getAll( options );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle get project vo
	* @param {int} id
	* @param {onject} query
	* @return {promise}
	*/
	async handleGetOne( id, query ) {
		const deferred = Q.defer();

		try {
			const options = {
				where: { id },
				include: {
					model: await VOApprover( this.channelId ),
					include: {
						model: await User( this.channelId ),
					},
				},
			};

			if ( this.account.isConstruction() || this.account.isConstructionManager() ) {
				options.attributes = [
					'id', 'project_id', 'name',
					'status', 'note', 'created_at',
				];
			}

			if ( query && query.query_for === 'approvers' ) {
				options.where = { id };
				options.include = {
					model: await VOApprover( this.channelId ),
				};

				return new ProjectVORepository( this.channelId ).getOne( options );
			}

			return new ProjectVORepository( this.channelId ).getOne( options );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle create project vo
	* @param {object} data - Project vo data
	* @return {promise}
	*/
	async handleCreate( data ) {
		const deferred = Q.defer();

		try {
			const projectVORepository = new ProjectVORepository( this.channelId );
			const project = await new ProjectRepository( this.channelId ).getOne({
				where: {
					id: data.project_id,
					quotation_status: CONSTANTS.QUOTATION_STATUS.APPROVED,
					qs_by: this.currentUser.id,
				},
			});

			if ( !project || !project.id ) {
				deferred.resolve({
					status	: false,
					message	: 'CREATE_VO_FAIL',
				});
				return deferred.promise;
			}

			const pendingVO = await projectVORepository.getOne({
				where: {
					project_id: data.project_id,
					status: {
						[ Op.in ]: [ CONSTANTS.PROJECT_VO_STATUS.PROCESSING, CONSTANTS.PROJECT_VO_STATUS.WAITING_APPROVAL ],
					},
				},
			});

			if ( pendingVO && pendingVO.id ) {
				deferred.resolve({
					status	: false,
					message	: 'CREATE_VO_FAIL',
				});
				return deferred.promise;
			}

			if ( data.discount_type === '%' && ( data.discount_amount < 0 || data.discount_amount > 100 )
				|| data.vat_percent < 0 || data.vat_percent > 100
			) {
				deferred.resolve({
					status	: false,
					message	: 'DATA_INVALID',
				});
				return deferred.promise;
			}

			const createData = {
				project_id		: data.project_id,
				name			: data.name,
				note			: data.note,
				vat_percent		: data.vat_percent,
				discount_type	: data.discount_type,
				discount_amount	: data.discount_amount,
			};
			return projectVORepository.create( createData );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update project vo
	* @param {int} id - Project vo id
	* @param {object} data - Project vo data
	* @return {promise}
	*/
	async handleUpdate( id, data ) {
		const deferred = Q.defer();

		try {
			const checkVO = await this._checkVO( id );

			if ( !checkVO || !checkVO.status ) {
				deferred.resolve({
					status	: false,
					message	: 'REMOVE_ITEMS_FAIL',
				});
				return deferred.promise;
			}

			if ( data.discount_type === '%' && ( data.discount_amount < 0 || data.discount_amount > 100 )
				|| data.vat_percent < 0 || data.vat_percent > 100
			) {
				deferred.resolve({
					status	: false,
					message	: 'DATA_INVALID',
				});
				return deferred.promise;
			}

			return new ProjectVORepository( this.channelId ).update({
				project_id		: data.project_id,
				name			: data.name,
				note			: data.note,
				vat_percent		: data.vat_percent,
				discount_type	: data.discount_type,
				discount_amount	: data.discount_amount,
			}, { where: { id } });
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle delete project vo
	* @param {int} id - Project vo id
	* @return {promise}
	*/
	async handleDelete( id ) {
		const deferred = Q.defer();

		try {
			const transaction = await new Model( this.channelId ).transaction();
			const checkVO = await this._checkVO( id, transaction );

			if ( !checkVO || !checkVO.status ) {
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'REMOVE_VO_FAIL',
				});
				return deferred.promise;
			}

			const getDeleteLineItems = await new ProjectLineItemRepository( this.channelId ).getAll({
				where: {
					vo_delete_id: { [ Op.is ]: null },
					vo_add_id: id,
				},
				transaction,
			});

			if ( getDeleteLineItems && getDeleteLineItems.length ) {
				const deleteLineItems = await new ProjectLineItemRepository( this.channelId ).bulkDelete({
					where: {
						vo_delete_id: { [ Op.is ]: null },
						vo_add_id: id,
					},
					transaction,
				});

				if ( !deleteLineItems || !deleteLineItems.status ) {
					transaction.rollback();

					deferred.resolve({
						status	: false,
						message	: 'REMOVE_VO_FAIL',
					});
					return deferred.promise;
				}
			}

			const getDeleteCostItems = await new ProjectCostItemRepository( this.channelId ).getAll({
				where: {
					vo_delete_id: { [ Op.is ]: null },
					vo_add_id: id,
				},
				transaction,
			});

			if ( getDeleteCostItems && getDeleteCostItems.length ) {
				const deleteCostItems = await new ProjectCostItemRepository( this.channelId ).bulkDelete({
					where: {
						vo_delete_id: { [ Op.is ]: null },
						vo_add_id: id,
					},
					transaction,
				});

				if ( !deleteCostItems || !deleteCostItems.status ) {
					transaction.rollback();

					deferred.resolve({
						status	: false,
						message	: 'REMOVE_VO_FAIL',
					});
					return deferred.promise;
				}
			}

			const deleteResult = await new ProjectVORepository( this.channelId ).delete({
				where: { id },
				transaction,
			});

			if ( !deleteResult || !deleteResult.status ) {
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'REMOVE_VO_FAIL',
				});
				return deferred.promise;
			}

			// Commit transaction
			transaction.commit();

			deferred.resolve({
				status	: true,
				message	: 'REMOVE_VO_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle remove items project vo
	* @param {int} id - Project vo id
	* @param {object} data - Project vo data
	* @return {promise}
	*/
	async handleRemoveItems( id, data ) {
		const deferred = Q.defer();

		try {
			const transaction = await new Model( this.channelId ).transaction();
			const checkVO = await this._checkVO( id, transaction );

			if ( !checkVO || !checkVO.status ) {
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'REMOVE_ITEMS_FAIL',
				});
				return deferred.promise;
			}

			const projectLineItemRepository = new ProjectLineItemRepository( this.channelId );
			const projectLineItemsReset = await projectLineItemRepository.bulkUpdate({
				vo_delete_id: null,
			}, {
				where: { vo_delete_id: id },
				transaction,
			});

			if ( !projectLineItemsReset || !projectLineItemsReset.status ) {
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'REMOVE_ITEMS_FAIL',
				});
				return deferred.promise;
			}

			const projectLineItemsUpdate = await Q.all( _.map( data.items, item => {
				return projectLineItemRepository.update({
					vo_delete_id: id,
				}, {
					where: { id: item },
					transaction,
				});
			}) );

			if ( !projectLineItemsUpdate
				|| _.contains( projectLineItemsUpdate, null )
				|| _.contains( _.map( projectLineItemsUpdate, 'status' ), false )
			) {
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'REMOVE_ITEMS_FAIL',
				});
				return deferred.promise;
			}

			// Commit transaction
			transaction.commit();

			deferred.resolve({
				status	: true,
				message	: 'REMOVE_ITEMS_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle remove items project vo
	* @param {int} id - Project vo id
	* @param {object} data - Project vo data
	* @return {promise}
	*/
	async handleRemoveItemsCost( id, data ) {
		const deferred = Q.defer();

		try {
			const transaction = await new Model( this.channelId ).transaction();
			const checkVO = await this._checkVO( id, transaction );

			if ( !checkVO || !checkVO.status ) {
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'REMOVE_ITEMS_FAIL',
				});
				return deferred.promise;
			}

			const projectCostItemRepository = new ProjectCostItemRepository( this.channelId );
			const projectCostItemsReset = await projectCostItemRepository.bulkUpdate({
				vo_delete_id: null,
			}, {
				where: { vo_delete_id: id },
				transaction,
			});

			if ( !projectCostItemsReset || !projectCostItemsReset.status ) {
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'REMOVE_ITEMS_FAIL',
				});
				return deferred.promise;
			}

			const projectCostItemsUpdate = await Q.all( _.map( data.items, item => {
				return projectCostItemRepository.update({
					vo_delete_id: id,
				}, {
					where: {
						id: item,
						is_extra: false,
						is_parent: false,
						project_purchase_order_id: null,
						project_id: checkVO.data.project_id,
					},
					transaction,
				});
			}) );

			if ( !projectCostItemsUpdate
				|| _.contains( projectCostItemsUpdate, null )
				|| _.contains( _.map( projectCostItemsUpdate, 'status' ), false )
			) {
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'REMOVE_ITEMS_FAIL',
				});
				return deferred.promise;
			}

			// Commit transaction
			transaction.commit();

			deferred.resolve({
				status	: true,
				message	: 'REMOVE_ITEMS_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle remove line project vo
	* @param {int} id - Project vo id
	* @param {object} data - Project vo data
	* @return {promise}
	*/
	async handleRemoveLine( id, data ) {
		const deferred = Q.defer();

		try {
			const transaction = await new Model( this.channelId ).transaction();
			const checkVO = await this._checkVO( id, transaction );

			if ( !checkVO || !checkVO.status ) {
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'REMOVE_LINE_FAIL',
				});
				return deferred.promise;
			}

			const projectLineItemRepository = new ProjectLineItemRepository( this.channelId );
			const projectLineItem = await projectLineItemRepository.getOne({
				where: {
					id: data.line_item_id,
					[ Op.or ]: [
						{ vo_add_id: id },
						{ vo_delete_id: id },
					],
				},
				transaction,
			});

			if ( !projectLineItem || !projectLineItem.id ) {
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'REMOVE_LINE_FAIL',
				});
				return deferred.promise;
			}

			const resultUpdate = await projectLineItemRepository.update({
				vo_delete_id: null,
			}, {
				where: {
					id: data.line_item_id,
				},
				transaction,
			});

			if ( !resultUpdate || !resultUpdate.status ) {
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'REMOVE_LINE_FAIL',
				});
				return deferred.promise;
			}

			if ( projectLineItem.vo_add_id && projectLineItem.vo_add_id === id ) {
				const resultDelete = await projectLineItemRepository.delete({
					transaction,
					where: {
						id: data.line_item_id,
					},
				});

				if ( !resultDelete || !resultDelete.status ) {
					transaction.rollback();

					deferred.resolve({
						status	: false,
						message	: 'REMOVE_LINE_FAIL',
					});
					return deferred.promise;
				}
			}

			// Commit transaction
			transaction.commit();

			deferred.resolve({
				status	: true,
				message	: 'REMOVE_LINE_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle remove cost project vo
	* @param {int} id - Project vo id
	* @param {object} data - Project vo data
	* @return {promise}
	*/
	async handleRemoveCost( id, data ) {
		const deferred = Q.defer();

		try {
			const transaction = await new Model( this.channelId ).transaction();
			const checkVO = await this._checkVO( id, transaction );

			if ( !checkVO || !checkVO.status ) {
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'REMOVE_COST_FAIL',
				});
				return deferred.promise;
			}

			const projectCostItemRepository = new ProjectCostItemRepository( this.channelId );
			const projectCostItem = await projectCostItemRepository.getOne({
				where: {
					id: data.cost_item_id,
					[ Op.or ]: [
						{ vo_add_id: id },
						{ vo_delete_id: id },
					],
				},
				transaction,
			});

			if ( !projectCostItem || !projectCostItem.id ) {
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'REMOVE_COST_FAIL',
				});
				return deferred.promise;
			}

			const resultUpdate = await projectCostItemRepository.update({
				vo_delete_id: null,
			}, {
				where: {
					id: data.cost_item_id,
				},
				transaction,
			});

			if ( !resultUpdate || !resultUpdate.status ) {
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'REMOVE_COST_FAIL',
				});
				return deferred.promise;
			}

			if ( projectCostItem.vo_add_id && projectCostItem.vo_add_id === id ) {
				const resultDelete = await projectCostItemRepository.delete({
					transaction,
					where: {
						id: data.cost_item_id,
					},
				});

				if ( !resultDelete || !resultDelete.status ) {
					transaction.rollback();

					deferred.resolve({
						status	: false,
						message	: 'REMOVE_COST_FAIL',
					});
					return deferred.promise;
				}
			}

			// Commit transaction
			transaction.commit();

			deferred.resolve({
				status	: true,
				message	: 'REMOVE_COST_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle remove cost project vo
	* @param {int} id - Project vo id
	* @param {object} data - Project vo data
	* @return {promise}
	*/
	async handleGetApproval( id, data ) {
		const deferred = Q.defer();

		try {
			const transaction = await new Model( this.channelId ).transaction();
			const projectVORepository = new ProjectVORepository( this.channelId );
			const vo = await projectVORepository.getOne({
				include: {
					model: await Project( this.channelId ),
					where: {
						quotation_status: CONSTANTS.QUOTATION_STATUS.APPROVED,
						qs_by: this.currentUser.id,
					},
				},
				where: {
					id,
					status: {
						[ Op.ne ]: CONSTANTS.PROJECT_VO_STATUS.APPROVED,
					},
				},
				transaction,
			});

			if ( !vo || !vo.id ) {
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'GET_APPROVAL_FAILED',
				});
				return deferred.promise;
			}

			const updateResult = await projectVORepository.update({
				status: data.status,
			}, {
				where: { id },
				transaction,
			});

			if ( !updateResult || !updateResult.status ) {
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'GET_APPROVAL_FAILED',
				});
				return deferred.promise;
			}

			const voApproverRepository = new VOApproverRepository( this.channelId );

			if ( data.status === CONSTANTS.PROJECT_VO_STATUS.WAITING_APPROVAL ) {
				const resultQuotaion = await Q.all([
					new ProjectLineItemRepository( this.channelId ).getAll({
						where: {
							[ Op.or ]: [
								{ vo_add_id: id },
								{ vo_delete_id: id },
							],
						},
						transaction,
					}),
					new ProjectVORepository( this.channelId ).getAll({
						where: {
							project_id: vo.project_id,
							status: CONSTANTS.PROJECT_VO_STATUS.APPROVED,
						},
						transaction,
					}),
					new ProjectLineUtility( this.channelId ).handleSumProjectLine( vo.project_id, transaction ),
					new ProjectBillRepository( this.channelId ).getAll({
						where: {
							project_id: vo.project_id,
						},
						transaction,
					}),
				]);

				if ( !resultQuotaion
					|| _.findWhere( resultQuotaion, { status: false } )
					|| _.contains( resultQuotaion, null )
				) {
					// Rollback transaction
					transaction.rollback();

					deferred.resolve({
						status	: false,
						message	: 'GET_APPROVAL_FAILED',
					});
					return deferred.promise;
				}

				// START check remaining valid
				let total = 0;

				_.each( resultQuotaion[ 0 ], item => {
					item.total = item.amount * item.price;
					item.status = item.vo_delete_id && item.vo_delete_id === id
						? CONSTANTS.VO_ITEM_STATUS.REMOVED
						: CONSTANTS.VO_ITEM_STATUS.ADDED;

					total += item.status === CONSTANTS.VO_ITEM_STATUS.ADDED ? item.total : ( -1 ) * item.total;
				});

				const discount = vo.discount_type ==='$'
					? vo.discount_amount
					: vo.discount_amount * total / 100;

				const totalWithoutVAT = total - discount;
				const vat = vo.vat_percent * totalWithoutVAT / 100;
				const diffQuotation = totalWithoutVAT + vat;

				let totalBills = 0;

				_.each( resultQuotaion[ 3 ], item => {
					totalBills += ( isNaN( item.total_real ) ? ( item.total || 0 ) : item.total_real )
						+ ( isNaN( item.total_vat_real ) ? ( item.total_vat || 0 ) : item.total_vat_real );
				});

				let totalDiffVO = 0;

				_.each( resultQuotaion[ 1 ], item => {
					totalDiffVO += item.diff_quotation_total + item.diff_quotation_vat;
				});

				const remaining = resultQuotaion[ 2 ] * 1.1 - totalBills + totalDiffVO;

				if ( remaining + diffQuotation < 0 ) {
					transaction.rollback();

					deferred.resolve({
						status	: false,
						message	: 'REMAINING_INVALID',
						data: { remaining },
					});
					return deferred.promise;
				}
				// END check remaining valid

				const deleteCurrentApprovers = await voApproverRepository.bulkDelete({
					where: {
						project_vo_id: id,
					},
					transaction,
				});

				if ( !deleteCurrentApprovers || deleteCurrentApprovers.length ) {
					transaction.rollback();

					deferred.resolve({
						status	: false,
						message	: 'GET_APPROVAL_FAILED',
					});
					return deferred.promise;
				}

				const createApproversData = [
					{
						status			: CONSTANTS.VO_APPROVE_STATUS.WAITING_APPROVAL,
						role_key		: 'CEO',
						project_vo_id	: id,
					},
					{
						status			: CONSTANTS.VO_APPROVE_STATUS.WAITING_APPROVAL,
						role_key		: 'PROCUREMENT_MANAGER',
						project_vo_id	: id,
					},
					{
						status			: CONSTANTS.VO_APPROVE_STATUS.WAITING_APPROVAL,
						role_key		: 'PM',
						user_id			: vo.project.manage_by,
						project_vo_id	: id,
					},
					{
						status			: CONSTANTS.VO_APPROVE_STATUS.WAITING_APPROVAL,
						role_key		: 'SALE',
						user_id			: vo.project.sale_by,
						project_vo_id	: id,
					},
				];

				const createApprovers = await voApproverRepository.bulkCreate( createApproversData, { transaction });

				if ( !createApprovers || !createApprovers.status ) {
					transaction.rollback();

					deferred.resolve({
						status	: false,
						message	: 'GET_APPROVAL_FAILED',
					});
					return deferred.promise;
				}
			}

			// Commit transaction
			transaction.commit();

			deferred.resolve({
				status	: true,
				message	: 'REMOVE_COST_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle remove cost project vo
	* @param {int} id - Project vo id
	* @param {object} data - Project vo data
	* @return {promise}
	*/
	async handleApprove( id, data ) {
		const deferred = Q.defer();

		try {
			const transaction = await new Model( this.channelId ).transaction();
			const projectVORepository = new ProjectVORepository( this.channelId );
			const optionsVO = {
				include: {
					model: await Project( this.channelId ),
					where: {
						quotation_status: CONSTANTS.QUOTATION_STATUS.APPROVED,
					},
				},
				where: {
					id,
					status: CONSTANTS.PROJECT_VO_STATUS.WAITING_APPROVAL,
				},
				transaction,
			};

			if ( this.account.isPM() ) optionsVO.include.where.manage_by = this.currentUser.id;
			const vo = await projectVORepository.getOne( optionsVO );

			if ( !vo || !vo.id || this.currentUser.id !== data.user_id ) {
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'APPROVE_FAILED',
				});
				return deferred.promise;
			}

			const voApproverRepository = new VOApproverRepository( this.channelId );
			const approveResult = await voApproverRepository.update( data, {
				where: { id: data.vo_approver_id },
				transaction,
			});

			if ( !approveResult || !approveResult.status ) {
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'APPROVE_FAILED',
				});
				return deferred.promise;
			}

			const allApprovers = await voApproverRepository.getAll({
				where: { project_vo_id: id },
				transaction,
			});

			if ( !allApprovers || !allApprovers.length ) {
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'APPROVE_FAILED',
				});
				return deferred.promise;
			}

			const approverStaus = {
				is_ceo_approved: false,
				other_approved: 0,
				other_count: 0,
			};

			_.filter( allApprovers, item => {
				if ( item.role_key === 'CEO' ) {
					approverStaus.is_ceo_approved = item.status === CONSTANTS.VO_APPROVE_STATUS.APPROVED;
				} else {
					item.status === CONSTANTS.VO_APPROVE_STATUS.APPROVED && approverStaus.other_approved++;
					approverStaus.other_count++;
				}
			});

			if (
				approverStaus.is_ceo_approved || ( approverStaus.other_approved === approverStaus.other_count )
				// allApprovers.length === _.filter( allApprovers, item => item.status === CONSTANTS.VO_APPROVE_STATUS.APPROVED ).length
			) {
				const lineItems = await new ProjectLineItemRepository( this.channelId ).getAll({
					where: {
						[ Op.or ]: [
							{ vo_add_id: id },
							{ vo_delete_id: id },
						],
					},
					transaction,
				});

				if ( !lineItems ) {
					transaction.rollback();

					deferred.resolve({
						status	: false,
						message	: 'APPROVE_FAILED',
					});
					return deferred.promise;
				}

				let total = 0;

				_.each( lineItems, item => {
					item.total = item.amount * item.price;
					item.status = item.vo_delete_id && item.vo_delete_id === id
						? CONSTANTS.VO_ITEM_STATUS.REMOVED
						: CONSTANTS.VO_ITEM_STATUS.ADDED;

					total += item.status === CONSTANTS.VO_ITEM_STATUS.ADDED ? item.total : ( -1 ) * item.total;
				});

				const discount = vo.discount_type ==='$'
					? vo.discount_amount
					: vo.discount_amount * total / 100;

				const totalWithoutVAT = total - discount;
				const vat = vo.vat_percent * totalWithoutVAT / 100;

				const voUpdate = await projectVORepository.update({
					status: CONSTANTS.PROJECT_VO_STATUS.APPROVED,
					diff_quotation_total: totalWithoutVAT,
					diff_quotation_vat	: vat,
				}, {
					where: { id },
					transaction,
				});

				if ( !voUpdate || !voUpdate.status ) {
					transaction.rollback();

					deferred.resolve({
						status	: false,
						message	: 'APPROVE_FAILED',
					});
					return deferred.promise;
				}
			}

			// Commit transaction
			transaction.commit();

			deferred.resolve({
				status	: true,
				message	: 'APPROVE_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle sum quotation
	* @param {int} projectId - Project id
	* @return {promise}
	*/
	handleSumQuotation( projectId ) {
		const deferred = Q.defer();

		try {
			return new VOUtility( this.channelId ).handleSumQuotation( projectId );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle check valid vo
	* @param {int} id - Project vo id
	* @param {object} transaction
	* @return {promise}
	*/
	async _checkVO( id, transaction ) {
		const deferred = Q.defer();

		try {
			const projectVO = await new ProjectVORepository( this.channelId ).getOne({
				include: {
					model: await Project( this.channelId ),
					where: {
						quotation_status: CONSTANTS.QUOTATION_STATUS.APPROVED,
						qs_by: this.currentUser.id,
					},
				},
				where: {
					id,
					status: {
						[ Op.notIn ]: [ CONSTANTS.PROJECT_VO_STATUS.APPROVED, CONSTANTS.PROJECT_VO_STATUS.WAITING_APPROVAL ],
					},
				},
				transaction,
			});

			if ( !projectVO || !projectVO.id ) {
				deferred.resolve({
					status	: false,
					message	: 'GET_VO_FAIL',
				});
				return deferred.promise;
			}

			deferred.resolve({
				status	: true,
				message	: 'GET_VO_SUCCESS',
				data	: projectVO,
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

}

module.exports = ProjectVOHandler;
