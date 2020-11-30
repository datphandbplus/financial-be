const Q = require( 'q' );
const _ = require( 'underscore' );
const Sequelize = require( 'sequelize' );

const PurchaseOrderApproverRepository = require( '@models/finance/project/purchase_order_approver_repository' );
const ProjectPurchaseOrder = require( '@models/finance/project/project_purchase_order' );
const ProjectPurchaseOrderRepository = require( '@models/finance/project/project_purchase_order_repository' );
const ProjectCostItemRepository = require( '@models/finance/project/project_cost_item_repository' );
const ProjectCostModification = require( '@models/finance/project/project_cost_modification' );
const User = require( '@models/finance/user/user' );

const { Model, Logger, Account } = require( '@helpers' );
const { CONSTANTS, STATUS_CODE, STATUS_MESSAGE } = require( '@resources' );

const Op = Sequelize.Op;

class PurchaseOrderApproverHandler {

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
	* Handle get project purchase order according project id
	* @param {object} queryOptions
	* @return {promise}
	*/
	async handleGetAll( queryOptions = {} ) {
		const deferred = Q.defer();

		try {
			if ( !queryOptions || !queryOptions.project_purchase_order_id ) {
				deferred.reject({
					status	: STATUS_CODE.BAD_REQUEST,
					message	: STATUS_MESSAGE.BAD_REQUEST,
				});
				return deferred.promise;
			}

			const options = {
				where	: { project_purchase_order_id: queryOptions.project_purchase_order_id },
				include	: { model: await User( this.channelId ) },
			};
			return new PurchaseOrderApproverRepository( this.channelId ).getAll( options );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update
	* @param {int} id
	* @param {object} data
	* @return {promise}
	*/
	async handleUpdate( id, data ) {
		const deferred = Q.defer();

		try {
			const transaction = await new Model( this.channelId ).transaction();
			const updateData = {
				user_id	: this.currentUser.id,
				comment	: data.comment,
				status	: data.status,
			};
			const updateOptions = { where: { id }, transaction };
			const purchaseOrderApproverRepository = new PurchaseOrderApproverRepository( this.channelId );
			const purchaseOrderApprover = await purchaseOrderApproverRepository.getOne( {
				where: { id },
				include: {
					model: await ProjectPurchaseOrder( this.channelId ),
					where: {
						status: {
							[ Op.in ]: [
								CONSTANTS.PURCHASE_ORDER_STATUS.REJECTED,
								CONSTANTS.PURCHASE_ORDER_STATUS.WAITING_APPROVAL,
								CONSTANTS.PURCHASE_ORDER_STATUS.MODIFIED,
							],
						},
					},
				},
				transaction,
			} );

			// Check create purchase order
			if ( !purchaseOrderApprover
				|| !purchaseOrderApprover.id
				|| ( purchaseOrderApprover.user_id && purchaseOrderApprover.user_id !== this.currentUser.id )
				|| this.currentUser.role_key !== purchaseOrderApprover.role_key ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'PURCHASE_ORDER_APPROVER_INVALID',
				});
				return deferred.promise;
			}

			const updateResult = await purchaseOrderApproverRepository.update( updateData, updateOptions );
			const projectPurchaseOrderRepository = new ProjectPurchaseOrderRepository( this.channelId );

			// Check create purchase order
			if ( !updateResult || !updateResult.status ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'UPDATE_PURCHASE_ORDER_APPROVER_FAIL',
				});
				return deferred.promise;
			}

			if ( data.status === CONSTANTS.PURCHASE_ORDER_APPROVE_STATUS.REJECTED
				&& purchaseOrderApprover.project_purchase_order.status !== CONSTANTS.PURCHASE_ORDER_STATUS.MODIFIED ) {
				const rejectResult = await projectPurchaseOrderRepository.update(
					{
						status: CONSTANTS.PURCHASE_ORDER_STATUS.REJECTED,
					},
					{
						where: { id: purchaseOrderApprover.project_purchase_order_id },
						transaction,
					}
				);

				// Check create purchase order
				if ( !rejectResult || !rejectResult.status ) {
					// Rollback transaction
					transaction.rollback();

					deferred.resolve({
						status	: false,
						message	: 'UPDATE_PURCHASE_ORDER_APPROVER_FAIL',
					});
					return deferred.promise;
				}
			}

			if ( data.status === CONSTANTS.PURCHASE_ORDER_APPROVE_STATUS.APPROVED ) {
				const allPurchaseOrderApprovers = await purchaseOrderApproverRepository.getAll( {
					where: { project_purchase_order_id: purchaseOrderApprover.project_purchase_order_id },
					transaction,
				} );

				// Check create purchase order
				if ( !allPurchaseOrderApprovers || !allPurchaseOrderApprovers.length ) {
					// Rollback transaction
					transaction.rollback();

					deferred.resolve({
						status	: false,
						message	: 'UPDATE_PURCHASE_ORDER_APPROVER_FAIL',
					});
					return deferred.promise;
				}

				const projectCostItemRepository = new ProjectCostItemRepository( this.channelId );
				const projectCostItems = await projectCostItemRepository.getAll( {
					where: { project_purchase_order_id: allPurchaseOrderApprovers[ 0 ].project_purchase_order_id },
					include: {
						model	: await ProjectCostModification( this.channelId ),
						where	: { status: CONSTANTS.COST_MODIFICATION_STATUS.WAITING },
						required: false,
					},
					transaction,
				} );

				if ( !projectCostItems || _.find( projectCostItems, item => {
					if ( item.project_cost_modifications.length ) return item;
				} ) ) {
					// Rollback transaction
					transaction.rollback();

					deferred.resolve({
						status	: false,
						message	: 'PO_HAS_COST_MODIFICATION_ITEMS',
					});
					return deferred.promise;
				}

				if ( allPurchaseOrderApprovers.length === _.filter(
					allPurchaseOrderApprovers,
					{ status: CONSTANTS.PURCHASE_ORDER_APPROVE_STATUS.APPROVED }
				).length ) {
					const poUpdateData = {
						status: CONSTANTS.PURCHASE_ORDER_STATUS.APPROVED,
					};

					if ( purchaseOrderApprover.project_purchase_order.status === CONSTANTS.PURCHASE_ORDER_STATUS.MODIFIED ) {
						const projectCostItemResultRemove = await projectCostItemRepository.update(
							{
								project_purchase_order_id: null,
							},
							{
								where: { project_purchase_order_id: purchaseOrderApprover.project_purchase_order_id },
								transaction,
							}
						);

						if ( !projectCostItemResultRemove || !projectCostItemResultRemove.status ) {
							// Rollback transaction
							transaction.rollback();

							deferred.resolve({
								status	: false,
								message	: 'UPDATE_COST_ITEM_FAIL',
							});
							return deferred.promise;
						}

						const newCostItem = JSON.parse( purchaseOrderApprover.project_purchase_order.new_data );
						const resultsUpdate = await Q.all( _.map(
							newCostItem,
							item => {
								const updateCostData = {
									project_purchase_order_id: ( item.modified_status !== CONSTANTS.MODIFIED_STATUS.REMOVED )
										? purchaseOrderApprover.project_purchase_order_id
										: null,
								};

								if ( item.modified_status === CONSTANTS.MODIFIED_STATUS.EDITED ) {
									updateCostData.amount = item.amount;
									updateCostData.price = item.price;
								}

								return projectCostItemRepository.update(
									updateCostData,
									{
										where: { id: item.id },
										transaction,
									}
								);
							}
						));

						if ( !resultsUpdate
							|| _.findWhere( resultsUpdate, { status: false } )
							|| _.contains( resultsUpdate, null )
						) {
							// Rollback transaction
							transaction.rollback();

							deferred.resolve({
								status	: false,
								message	: 'UPDATE_COST_FAIL',
							});
							return deferred.promise;
						}

						poUpdateData.old_data = null;
						poUpdateData.new_data = null;
					}

					const approveResult = await projectPurchaseOrderRepository.update(
						poUpdateData,
						{
							where: { id: purchaseOrderApprover.project_purchase_order_id },
							transaction,
						}
					);

					// Check create purchase order
					if ( !approveResult || !approveResult.status ) {
						// Rollback transaction
						transaction.rollback();

						deferred.resolve({
							status	: false,
							message	: 'UPDATE_PURCHASE_ORDER_APPROVER_FAIL',
						});
						return deferred.promise;
					}
				} else if ( !_.filter(
					allPurchaseOrderApprovers,
					{ status: CONSTANTS.PURCHASE_ORDER_APPROVE_STATUS.REJECTED }
				).length
				&& purchaseOrderApprover.project_purchase_order.status !== CONSTANTS.PURCHASE_ORDER_STATUS.MODIFIED ) {
					const approveResult = await projectPurchaseOrderRepository.update(
						{
							status: CONSTANTS.PURCHASE_ORDER_STATUS.WAITING_APPROVAL,
						},
						{
							where: { id: purchaseOrderApprover.project_purchase_order_id },
							transaction,
						}
					);

					// Check create purchase order
					if ( !approveResult || !approveResult.status ) {
						// Rollback transaction
						transaction.rollback();

						deferred.resolve({
							status	: false,
							message	: 'UPDATE_PURCHASE_ORDER_APPROVER_FAIL',
						});
						return deferred.promise;
					}
				}
			}

			// Commit transaction
			transaction.commit();

			deferred.resolve({
				status	: true,
				message	: 'UPDATE_PURCHASE_ORDER_APPROVER_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

}

module.exports = PurchaseOrderApproverHandler;
