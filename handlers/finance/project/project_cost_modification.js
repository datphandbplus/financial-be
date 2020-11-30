const Q = require( 'q' );
const _ = require( 'underscore' );
const Sequelize = require( 'sequelize' );

const User = require( '@models/finance/user/user' );
const Project = require( '@models/finance/project/project' );
const ProjectCostUtility = require( '@models/finance/project/project_cost_utility' );
const ProjectCostItem = require( '@models/finance/project/project_cost_item' );
const ProjectCostItemRepository = require( '@models/finance/project/project_cost_item_repository' );
const ProjectCostModificationRepository = require( '@models/finance/project/project_cost_modification_repository' );
const ProjectCostModification = require( '@models/finance/project/project_cost_modification' );
const ProjectPurchaseOrder = require( '@models/finance/project/project_purchase_order' );
const Vendor = require( '@models/finance/vendor/vendor' );

const { Logger, Account, Model } = require( '@helpers' );
const { STATUS_CODE, CONSTANTS } = require( '@resources' );
const Op = Sequelize.Op;

class ProjectCostModificationHandler {

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
	* Handle get project cost items
	* @param {object} queryOptions
	* @return {promise}
	*/
	async handleGetAll( queryOptions = {} ) {
		const deferred = Q.defer();

		try {
			const options = {
				attributes: [
					'id', 'project_id', 'project_cost_item_id', 'name', 'unit',
					'old_amount', 'old_price', 'new_amount',
					'new_price', 'status', 'approve_by',
					'created_at', 'updated_at',
					[ Sequelize.col( 'project_cost_item->project_purchase_order.id' ), 'po_code' ],
					[ Sequelize.col( 'project_cost_item->vendor.short_name' ), 'vendor_name' ],
					[ Sequelize.col( 'project_cost_item->vendor.id' ), 'vendor_id' ],
				],
				include: [
					{
						model		: await User( this.channelId ),
						attributes	: [ 'id', 'full_name' ],
					},
					{
						model		: await Vendor( this.channelId ),
						attributes	: [ 'id', 'short_name' ],
					},
					{
						model		: await ProjectCostItem( this.channelId ),
						attributes	: [],
						include: [
							{
								model		: await ProjectPurchaseOrder( this.channelId ),
								attributes	: [],
							},
							{
								model		: await Vendor( this.channelId ),
								attributes	: [],
							},
						],
					},
				],
			};

			if ( queryOptions.project_id ) options.where = { project_id: queryOptions.project_id };

			return new ProjectCostModificationRepository( this.channelId ).getAll( options );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle modify cost
	* @param {int} projectCostItemId
	* @param {object} data
	* @return {promise}
	*/
	async handleModifyCost( projectCostItemId, data ) {
		const deferred = Q.defer();

		try {
			const transaction = await new Model( this.channelId ).transaction();
			const result = await new ProjectCostUtility( this.channelId )
			.handleModify( {
				id			: projectCostItemId,
				vendor_id	: data.vendor_id,
				amount		: +data.amount,
				price		: +data.price,
			},
			transaction );

			if ( !result || !result.status ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve( result );
				return deferred.promise;
			}

			// Commit transaction
			transaction.commit();

			deferred.resolve({
				status	: true,
				message	: 'UPDATE_PROJECT_COST_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update project cost modification status
	* @param {int} id - Project cost modification id
	* @param {object} data - Project cost modification data
	* @return {promise}
	*/
	async handleUpdateStatus( id, data ) {
		const deferred = Q.defer();

		try {
			const projectCostModificationRepository = new ProjectCostModificationRepository( this.channelId );
			const transaction = await new Model( this.channelId ).transaction();
			const options = {
				attributes: [
					'id', 'project_id', 'project_cost_item_id',
					'status', 'new_amount', 'new_price',
					'old_amount', 'old_price',
				],
				where: {
					id,
					approve_by	: null,
					status		: CONSTANTS.COST_MODIFICATION_STATUS.WAITING,
				},
				include: [
					{
						model		: await Project( this.channelId ),
						attributes	: [ 'id', 'total_extra_fee' ],
						where		: { quotation_status: CONSTANTS.QUOTATION_STATUS.APPROVED },
					},
					{
						model: await ProjectCostItem( this.channelId ),
						required: true,
					},
				],
				transaction,
			};
			const projectCostModification = await projectCostModificationRepository.getOne( options );

			if ( !projectCostModification ) {
				// Rollback transaction
				transaction.rollback();

				deferred.reject({
					status	: STATUS_CODE.BAD_REQUEST,
					message	: 'PROJECT_COST_MODIFICATION_INVALID',
				});
				return deferred.promise;
			}

			// Procurement Manager cannot make decison on cost
			// match Total Extra Fee condition
			if ( this.account.isProcurementManager() ) {
				const project = projectCostModification.project;
				const projectCostItem = projectCostModification.project_cost_item;

				// Check is new cost with cost item extra
				const isNewCost = projectCostItem.is_extra
					&& ( projectCostItem.bk_price === null );

				const baseTotal = ( isNewCost ? 0 : +( projectCostItem.bk_amount || projectCostItem.amount ) )
					* +( projectCostItem.bk_price || projectCostItem.price );

				const sumResult = await new ProjectCostUtility( this.channelId )
				.handleSumProjectCost( projectCostModification.project_id, transaction );
				const maxTotalExtraFee = sumResult.base * +project.total_extra_fee / 100;
				const newTotal = projectCostModification.new_amount * projectCostModification.new_price;

				// New total over max total extra fee
				if ( sumResult.modified - sumResult.base - baseTotal + newTotal > maxTotalExtraFee ) {
					// Rollback transaction
					transaction.rollback();

					deferred.resolve({
						status	: false,
						message	: 'OVER_TOTAL_EXTRA_FEE',
					});
					return deferred.promise;
				}
			}

			const projectCostItem = projectCostModification.project_cost_item;
			const updateData = {
				status		: data.status,
				approve_by	: this.currentUser.id,
			};
			const updateOptions = {
				where: { id },
				transaction,
			};
			const result = await projectCostModificationRepository.update( updateData, updateOptions );

			if ( !result || !result.status ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'UPDATE_PROJECT_COST_MODIFICATION_FAIL',
				});
				return deferred.promise;
			}

			// Update new amout, price when status is valid or approved
			if ( _.contains(
				[ CONSTANTS.COST_MODIFICATION_STATUS.APPROVED ],
				updateData.status )
			) {
				const costItemUpdateData = {
					amount	: projectCostModification.new_amount,
					price	: projectCostModification.new_price,
				};
				const costItemUpdateOptions = {
					where: {
						id			: projectCostModification.project_cost_item_id,
						project_id	: projectCostModification.project_id,
					},
					transaction,
				};

				// Backup base amount, price
				if ( projectCostItem.bk_price === null ) {
					costItemUpdateData.bk_amount = projectCostModification.old_amount;
					costItemUpdateData.bk_price = projectCostModification.old_price;
				}

				if ( projectCostItem.parent_id ) {
					const updateParentResult = await new ProjectCostItemRepository( this.channelId ).update(
						{ is_parent: true },
						{
							where: { id: projectCostItem.parent_id },
							transaction,
						}
					);

					if ( !updateParentResult || !updateParentResult.status ) {
						// Rollback transaction
						transaction.rollback();

						deferred.resolve({
							status	: false,
							message	: 'UPDATE_PROJECT_COST_FAIL',
						});
						return deferred.promise;
					}
				}

				const updateResult = await new ProjectCostItemRepository( this.channelId )
				.update( costItemUpdateData, costItemUpdateOptions );

				if ( !updateResult || !updateResult.status ) {
					// Rollback transaction
					transaction.rollback();

					deferred.resolve({
						status	: false,
						message	: 'UPDATE_PROJECT_COST_MODIFICATION_FAIL',
					});
					return deferred.promise;
				}
			}

			// Update new amout, price when status is valid or approved
			if ( projectCostItem.parent_id && _.contains(
				[ CONSTANTS.COST_MODIFICATION_STATUS.REJECTED ],
				updateData.status )
			) {
				const projectCostItemRepository = new ProjectCostItemRepository( this.channelId );
				const childrenProjectCostItem = await projectCostItemRepository.getAll({
					transaction,
					where: { parent_id: projectCostItem.parent_id },
					include: {
						model: await ProjectCostModification( this.channelId ),
						order: [[ 'id', 'DESC' ]],
						required: false,
					},
					order: [[ 'id', 'ASC' ]],
				});

				if ( !childrenProjectCostItem || !childrenProjectCostItem.length ) {
					// Rollback transaction
					transaction.rollback();

					deferred.resolve({
						status	: false,
						message	: 'GET_CHILDREN_FAIL',
					});
					return deferred.promise;
				}

				const parentProjectCostItem = await projectCostItemRepository.getOne({
					transaction,
					where: { id: projectCostItem.parent_id },
					include: {
						model: await ProjectCostModification( this.channelId ),
						where: {
							status: { [ Op.ne ]: CONSTANTS.COST_MODIFICATION_STATUS.WAITING },
						},
						required: false,
					},
				});

				if ( !parentProjectCostItem
					|| !parentProjectCostItem.id
					|| ( parentProjectCostItem.is_extra
						&& ( parentProjectCostItem.bk_price === null ) ) ) {
					// Rollback transaction
					transaction.rollback();

					deferred.resolve({
						status	: false,
						message	: 'GET_PARENT_FAIL',
					});
					return deferred.promise;
				}

				const needUpdateModificatedItems = [];

				let total = 0;
				_.each( childrenProjectCostItem, costItem => {
					if ( costItem.project_cost_modifications
						&& costItem.project_cost_modifications.length
						&& costItem.project_cost_modifications[ 0 ].status === CONSTANTS.COST_MODIFICATION_STATUS.REJECTED
						&& ( costItem.bk_price === null ) ) return;

					total += costItem.amount * costItem.price;

					if ( total <= ( parentProjectCostItem.amount * parentProjectCostItem.price )
						&& costItem.project_cost_modifications
						&& costItem.project_cost_modifications.length
						&& costItem.project_cost_modifications[ 0 ].status === CONSTANTS.COST_MODIFICATION_STATUS.WAITING ) {
						needUpdateModificatedItems.push({
							id					: costItem.project_cost_modifications[ 0 ].id,
							old_price			: costItem.project_cost_modifications[ 0 ].old_price,
							old_amount			: costItem.project_cost_modifications[ 0 ].old_amount,
							new_price			: costItem.project_cost_modifications[ 0 ].new_price,
							new_amount			: costItem.project_cost_modifications[ 0 ].new_amount,
							status				: CONSTANTS.COST_MODIFICATION_STATUS.VALID,
							project_cost_item_id: costItem.project_cost_modifications[ 0 ].project_cost_item_id,
						});
					}
				});

				if ( needUpdateModificatedItems.length ) {
					const resultBulkUpdateModification = await projectCostModificationRepository
					.bulkCreate( needUpdateModificatedItems, { updateOnDuplicate: [ 'status' ], transaction } );

					if ( !resultBulkUpdateModification || !resultBulkUpdateModification.status ) {
						// Rollback transaction
						transaction.rollback();

						deferred.resolve({
							status	: false,
							message	: 'UPDATE_FAIL',
						});
						return deferred.promise;
					}

					const dataBulkCreate = [];

					_.each( needUpdateModificatedItems, item => {
						dataBulkCreate.push({
							id			: item.project_cost_item_id,
							bk_price	: item.old_price,
							bk_amount	: item.old_amount,
						});
					});

					const resultBulkUpdateCost = await projectCostItemRepository
					.bulkCreate(
						dataBulkCreate,
						{
							updateOnDuplicate: [ 'bk_price', 'bk_amount' ],
							transaction,
						}
					);

					if ( !resultBulkUpdateCost || !resultBulkUpdateCost.status ) {
						// Rollback transaction
						transaction.rollback();

						deferred.resolve({
							status	: false,
							message	: 'UPDATE_FAIL',
						});
						return deferred.promise;
					}
				}
			}

			// Commit transaction
			transaction.commit();

			deferred.resolve( result );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

}

module.exports = ProjectCostModificationHandler;
