const Q = require( 'q' );
const _ = require( 'underscore' );
const Sequelize = require( 'sequelize' );

const ProjectPurchaseOrderRepository = require( '@models/finance/project/project_purchase_order_repository' );
const ProjectCostItemRepository = require( '@models/finance/project/project_cost_item_repository' );
const ProjectCostItem = require( '@models/finance/project/project_cost_item' );
const Vendor = require( '@models/finance/vendor/vendor' );
const PurchaseOrderApproverRepository = require( '@models/finance/project/purchase_order_approver_repository' );
const PurchaseOrderApprover = require( '@models/finance/project/purchase_order_approver' );
const ProjectRepository = require( '@models/finance/project/project_repository' );
const Project = require( '@models/finance/project/project' );
const ProjectPayment = require( '@models/finance/project/project_payment' );
const UserRepository = require( '@models/finance/user/user_repository' );
const ProjectCostModification = require( '@models/finance/project/project_cost_modification' );

const { Model, Logger, Account } = require( '@helpers' );
const { CONSTANTS, STATUS_CODE, STATUS_MESSAGE } = require( '@resources' );

const Op = Sequelize.Op;

class ProjectPurchaseOrderHandler {

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
			if ( !queryOptions || !queryOptions.project_id ) {
				deferred.reject({
					status	: STATUS_CODE.BAD_REQUEST,
					message	: STATUS_MESSAGE.BAD_REQUEST,
				});
				return deferred.promise;
			}

			const costItemOptions = {
				model: await ProjectCostItem( this.channelId ),
				include: {
					model		: await ProjectCostModification( this.channelId ),
					attributes	: [ 'id', 'status' ],
				},
			};

			if ( this.account.isConstruction() ) {
				costItemOptions.attributes = [
					'id', 'project_id', 'project_line_item_id',
					'vendor_id', 'cost_item_category_id', 'project_purchase_order_id',
					'name', 'unit', 'amount',
					'bk_amount', 'is_extra', 'note',
					'description', 'image', 'created_at',
					'updated_at', 'is_parent', 'parent_id',
					'vo_delete_id', 'vo_add_id',
				];
			}

			const options = {
				where: { project_id: queryOptions.project_id },
				include: [
					costItemOptions,
					{ model: await Vendor( this.channelId ) },
					{ model: await PurchaseOrderApprover( this.channelId ) },
					{
						model		: await ProjectPayment( this.channelId ),
						attributes	: [
							'id', 'total', 'total_vat',
							'total_real', 'total_vat_real',
						],
					},
					{
						model		: await Project( this.channelId ),
						attributes	: [ 'id', 'valid_duration' ],
					},
				],
			};

			if ( this.account.isConstruction() ) {
				options.attributes = [
					'id', 'project_id', 'vendor_id',
					'name', 'status', 'description',
					'note', 'created_at', 'updated_at',
					'old_data', 'new_data', 'old_status',
				];
			}

			return new ProjectPurchaseOrderRepository( this.channelId ).getAll( options );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle get project purchase order according project id
	* @param {int} id
	* @param {object} queryOptions
	* @return {promise}
	*/
	async handleGetOne( id, queryOptions = {} ) {
		const deferred = Q.defer();

		try {
			if ( !queryOptions || !queryOptions.project_id ) {
				deferred.reject({
					status	: STATUS_CODE.BAD_REQUEST,
					message	: STATUS_MESSAGE.BAD_REQUEST,
				});
				return deferred.promise;
			}

			const options = {
				where: {
					id,
					project_id: queryOptions.project_id,
				},
				include: [
					{
						model: await ProjectCostItem( this.channelId ),
						include: {
							model		: await ProjectCostModification( this.channelId ),
							attributes	: [ 'id', 'status' ],
						},
					},
					{ model: await Vendor( this.channelId ) },
					{ model: await PurchaseOrderApprover( this.channelId ) },
				],
			};
			return new ProjectPurchaseOrderRepository( this.channelId ).getOne( options );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle create
	* @param {object} data
	* @return {promise}
	*/
	async handleCreate( data ) {
		const deferred = Q.defer();

		try {
			const transaction = await new Model( this.channelId ).transaction();
			const createData = {
				project_id		: data.project_id,
				vendor_id		: data.vendor_id,
				name			: data.name,
				vat_percent		: data.vat_percent,
				discount_amount	: data.discount_amount,
				discount_type	: data.discount_type,
				description		: data.description,
				note			: data.note,
			};

			if ( data.discount_type === '%' && ( data.discount_amount < 0 || data.discount_amount > 100 ) ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'DATA_INVALID',
				});
				return deferred.promise;
			}

			const project = await new ProjectRepository( this.channelId ).getOne( {
				where: { id: data.project_id },
				transaction,
			} );

			if ( !project || project.purchase_by !== this.currentUser.id ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'CREAT_PROJECT_PURCHASE_ORDER_FAIL',
				});
				return deferred.promise;
			}

			const resultCreate = await new ProjectPurchaseOrderRepository( this.channelId ).create( createData, { transaction } );

			// Check create purchase order
			if ( !resultCreate || !resultCreate.status ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'CREAT_PROJECT_PURCHASE_ORDER_FAIL',
				});
				return deferred.promise;
			}

			const discountValue = ( data.discount_type === '%' )
				? 0
				: data.discount_amount;
			let totalCostItems = 0;

			// Check cost items
			const projectCostItemRepository = new ProjectCostItemRepository( this.channelId );
			const resultsCostItems = await Q.all( _.map( data.selected_cost_items, async item => {
				totalCostItems += item.amount * item.price;

				return projectCostItemRepository.getOne( {
					where: {
						id							: item.id,
						project_id					: item.project_id,
						vendor_id					: item.vendor_id,
						project_purchase_order_id	: null,
					},
					include: {
						model		: await ProjectCostModification( this.channelId ),
						attributes	: [ 'id', 'status' ],
					},
					transaction,
				} );
			} ) );

			// Incase of not complete Q OR found null item OR item latest status is WAITING => rollback
			if ( !resultsCostItems
				|| _.contains( resultsCostItems, null )
				|| _.filter( resultsCostItems, item => {
					if ( item.project_cost_modifications.length
						&& _.last( item.project_cost_modifications ).status === CONSTANTS.COST_MODIFICATION_STATUS.WAITING
					) {
						return item;
					}
				} ).length
				|| discountValue > totalCostItems
			) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'CREAT_PROJECT_PURCHASE_ORDER_FAIL',
				});
				return deferred.promise;
			}

			const resultsUpdate = await Q.all( _.map( data.selected_cost_items, item => {
				return projectCostItemRepository.update( {
					project_purchase_order_id: resultCreate.data.id,
				},
				{
					where: {
						id							: item.id,
						project_purchase_order_id	: null,
					},
					transaction,
				} );
			} ) );

			if ( !resultsUpdate
				|| _.findWhere( resultsUpdate, { status: false } )
				|| _.contains( resultsUpdate, null )
			) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'CREAT_PROJECT_PURCHASE_ORDER_FAIL',
				});
				return deferred.promise;
			}

			// Commit transaction
			transaction.commit();

			deferred.resolve({
				status	: true,
				message	: 'CREAT_PROJECT_PURCHASE_ORDER_SUCCESS',
			});
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
			const purchaseOrderData = {
				where: {
					status: {
						[ Op.notIn ]: [
							CONSTANTS.PURCHASE_ORDER_STATUS.WAITING_APPROVAL,
							CONSTANTS.PURCHASE_ORDER_STATUS.APPROVED,
							CONSTANTS.PURCHASE_ORDER_STATUS.MODIFIED,
						],
					},
					id,
				},
				include: [
					{ model: await ProjectPayment( this.channelId ) },
					{
						model: await Project( this.channelId ),
						where: {
							purchase_by: this.currentUser.id,
						},
					},
				],
				transaction,
			};
			const projectPurchaseOrderRepository = new ProjectPurchaseOrderRepository( this.channelId );
			const resultPurchaseOrder = await projectPurchaseOrderRepository.getOne( purchaseOrderData );

			// Check purchase order
			if ( !resultPurchaseOrder || !resultPurchaseOrder.id ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'PROJECT_PURCHASE_ORDER_NOT_FOUND',
				});
				return deferred.promise;
			}

			if ( data.discount_type === '%' && ( data.discount_amount < 0 || data.discount_amount > 100 ) ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'DATA_INVALID',
				});
				return deferred.promise;
			}

			const updatePOData = {
				discount_amount	: data.discount_amount,
				discount_type	: data.discount_type,
			};

			if ( resultPurchaseOrder.status === CONSTANTS.PURCHASE_ORDER_STATUS.APPROVED ) {
				updatePOData.status = CONSTANTS.PURCHASE_ORDER_STATUS.WAITING_APPROVAL;

				const setApproverResult = await this._setApprover( id, resultPurchaseOrder.project, transaction );

				if ( !setApproverResult || !setApproverResult.status ) {
					// Rollback transaction
					transaction.rollback();

					deferred.resolve({
						status	: false,
						message	: 'UPDATE_FAILED',
					});
					return deferred.promise;
				}
			} else {
				updatePOData.note = data.note;
				updatePOData.name = data.name;
				updatePOData.vat_percent = data.vat_percent;
				updatePOData.description = data.description;
			}

			const resultUpdatePurchaseOrder = await projectPurchaseOrderRepository.update(
				updatePOData,
				{
					where: { id },
					transaction,
				}
			);

			// Check purchase order
			if ( !resultUpdatePurchaseOrder || !resultUpdatePurchaseOrder.status ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'UPDATE_PROJECT_PURCHASE_ORDER_FAIL',
				});
				return deferred.promise;
			}

			let totalPaymentPlanned = 0;
			_.each( resultPurchaseOrder.project_payments, payment => {
				totalPaymentPlanned += ( payment.status === CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED )
					? ( payment.total_real || 0 )
					: ( payment.total || 0 );
			});

			// Check cost items
			const projectCostItemRepository = new ProjectCostItemRepository( this.channelId );
			const resultsGetCostItems = await projectCostItemRepository.bulkUpdate( {
				project_purchase_order_id: null,
			},
			{
				where: { project_purchase_order_id: id },
				transaction,
			} );

			if ( !resultsGetCostItems || !resultsGetCostItems.status ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'UPDATE_PROJECT_PURCHASE_ORDER_FAIL',
				});
				return deferred.promise;
			}

			let totalCostItems = 0;

			// Check cost items
			const resultsCostItems = await Q.all( _.map( data.selected_cost_items, async item => {
				totalCostItems += item.amount * item.price;

				return projectCostItemRepository.getOne( {
					where: {
						id							: item.id,
						project_id					: item.project_id,
						vendor_id					: item.vendor_id,
						project_purchase_order_id	: null,
					},
					include: {
						model		: await ProjectCostModification( this.channelId ),
						attributes	: [ 'id', 'status' ],
					},
					transaction,
				} );
			} ) );

			const discountValue = ( data.discount_type === '%' )
				? totalCostItems * data.discount_amount / 100
				: data.discount_amount;

			// Incase of not complete Q OR found null item OR item latest status is WAITING => rollback
			if ( !resultsCostItems
				|| _.contains( resultsCostItems, null )
				|| _.filter( resultsCostItems, item => {
					if ( item.project_cost_modifications.length
						&& _.last( item.project_cost_modifications ).status === CONSTANTS.COST_MODIFICATION_STATUS.WAITING
					) {
						return item;
					}
				} ).length
				|| discountValue > totalCostItems
				|| ( totalPaymentPlanned && ( ( totalCostItems - discountValue ) < totalPaymentPlanned ) )
			) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'UPDATE_PROJECT_PURCHASE_ORDER_FAIL',
				});
				return deferred.promise;
			}

			const resultsUpdate = await Q.all( _.map( data.selected_cost_items, item => {
				return projectCostItemRepository.update( {
					project_purchase_order_id: id,
				},
				{
					where: {
						id: item.id,
						project_purchase_order_id: null,
					},
					transaction,
				} );
			} ) );

			if ( !resultsUpdate
				|| _.findWhere( resultsUpdate, { status: false } )
				|| _.contains( resultsUpdate, null )
			) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'UPDATE_PROJECT_PURCHASE_ORDER_FAIL',
				});
				return deferred.promise;
			}

			// Commit transaction
			transaction.commit();

			deferred.resolve({
				status	: true,
				message	: 'UPDATE_PROJECT_PURCHASE_ORDER_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle Modify
	* @param {int} id
	* @param {object} data
	* @return {promise}
	*/
	async handleModify( id, data ) {
		const deferred = Q.defer();

		try {
			const transaction = await new Model( this.channelId ).transaction();
			const purchaseOrderData = {
				where: {
					status: CONSTANTS.PURCHASE_ORDER_STATUS.APPROVED,
					id,
				},
				include: [
					{
						model: await Project( this.channelId ),
						where: {
							purchase_by: this.currentUser.id,
						},
					},
					{ model: await ProjectPayment( this.channelId ) },
					{ model: await ProjectCostItem( this.channelId ) },
				],
				transaction,
			};
			const projectPurchaseOrderRepository = new ProjectPurchaseOrderRepository( this.channelId );
			const resultPurchaseOrder = await projectPurchaseOrderRepository.getOne( purchaseOrderData );

			// Check purchase order
			if ( !resultPurchaseOrder || !resultPurchaseOrder.id ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'PROJECT_PURCHASE_ORDER_NOT_FOUND',
				});
				return deferred.promise;
			}

			if ( data.discount_type === '%' && ( data.discount_amount < 0 || data.discount_amount > 100 ) ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'DISCOUNT_INVALID',
				});
				return deferred.promise;
			}

			const costItems = data.selected_cost_items;
			const updatePOData = {
				discount_amount_bk	: resultPurchaseOrder.discount_amount,
				discount_type_bk	: resultPurchaseOrder.discount_type,
				old_data			: JSON.stringify( resultPurchaseOrder.project_cost_items ),

				discount_amount		: data.discount_amount,
				discount_type		: data.discount_type,
				status				: CONSTANTS.PURCHASE_ORDER_STATUS.MODIFIED,
				new_data			: JSON.stringify( _.map( costItems, costItemData => ({
					id: costItemData.id,
					project_id: costItemData.project_id,
					project_line_item_id: costItemData.project_line_item_id,
					vendor_id: costItemData.vendor_id,
					cost_item_category_id: costItemData.cost_item_category_id,
					project_purchase_order_id: costItemData.project_purchase_order_id,
					name: costItemData.name,
					unit: costItemData.unit,
					amount: costItemData.amount,
					price: costItemData.price,
					is_extra: costItemData.is_extra,
					is_parent: costItemData.is_parent,
					parent_id: costItemData.parent_id,
					note: costItemData.note,
					description: costItemData.description,
					status: costItemData.status,
					modified_status: costItemData.modified_status,
					project_cost_modifications: costItemData.project_cost_modifications,
				}))),
			};

			const setApproverResult = await this._setApprover( id, resultPurchaseOrder.project, transaction );

			if ( !setApproverResult || !setApproverResult.status ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'SET_APPROVER_FAILED',
				});
				return deferred.promise;
			}

			const resultUpdatePurchaseOrder = await projectPurchaseOrderRepository.update(
				updatePOData,
				{
					where: { id },
					transaction,
				}
			);

			// Check purchase order
			if ( !resultUpdatePurchaseOrder || !resultUpdatePurchaseOrder.status ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'UPDATE_PROJECT_PURCHASE_ORDER_FAIL',
				});
				return deferred.promise;
			}

			let totalPaymentPlanned = 0;
			_.each( resultPurchaseOrder.project_payments, payment => {
				totalPaymentPlanned += ( payment.status === CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED )
					? ( payment.total_real || 0 )
					: ( payment.total || 0 );
			});

			// Check cost items
			const projectCostItemRepository = new ProjectCostItemRepository( this.channelId );

			// const resultsGetCostItems = await projectCostItemRepository.bulkUpdate( {
			// 	project_purchase_order_id: null,
			// },
			// {
			// 	where: { project_purchase_order_id: id },
			// 	transaction,
			// } );

			// if ( !resultsGetCostItems || !resultsGetCostItems.status ) {
			// 	// Rollback transaction
			// 	transaction.rollback();

			// 	deferred.resolve({
			// 		status	: false,
			// 		message	: 'UPDATE_PROJECT_PURCHASE_ORDER_FAIL',
			// 	});
			// 	return deferred.promise;
			// }

			let totalCostItems = 0;

			// Check cost items
			const resultsCostItems = await Q.all( _.map( costItems, async item => {
				totalCostItems += item.amount * item.price;

				const checkAddOptions = {
					id			: item.id,
					project_id	: item.project_id,
					vendor_id	: item.vendor_id,
				};

				if ( item.modified_status !== CONSTANTS.MODIFIED_STATUS.EDITED ) {
					checkAddOptions.amount = item.amount;
					checkAddOptions.price = item.price;
				}

				return projectCostItemRepository.getOne( {
					where: checkAddOptions,
					include: {
						model		: await ProjectCostModification( this.channelId ),
						attributes	: [ 'id', 'status' ],
					},
					transaction,
				} );
			} ) );

			const discountValue = ( data.discount_type === '%' )
				? totalCostItems * data.discount_amount / 100
				: data.discount_amount;

			// Incase of not complete Q OR found null item OR item latest status is WAITING => rollback
			if ( !resultsCostItems
				|| _.contains( resultsCostItems, null )
				|| _.filter( resultsCostItems, item => {
					if ( item.project_cost_modifications.length
						&& _.last( item.project_cost_modifications ).status === CONSTANTS.COST_MODIFICATION_STATUS.WAITING
					) {
						return item;
					}
				} ).length
				|| discountValue > totalCostItems
				|| ( totalPaymentPlanned && ( ( totalCostItems - discountValue ) < totalPaymentPlanned ) )
			) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'DATA_INVALID',
				});
				return deferred.promise;
			}

			const resultsUpdate = await Q.all( _.map( costItems, item => {
				return projectCostItemRepository.update( {
					project_purchase_order_id: id,
				},
				{
					where: { id: item.id },
					transaction,
				} );
			} ) );

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

			// Commit transaction
			transaction.commit();

			deferred.resolve({
				status	: true,
				message	: 'UPDATE_PROJECT_PURCHASE_ORDER_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle change status
	* @param {int} id - Project bill id
	* @param {object} data - Project bill data
	* @return {promise}
	*/
	async handleChangeStatus( id, data ) {
		const deferred = Q.defer();

		try {
			// Prevent directly change status except WAITING_APPROVAL & CANCELLED
			if ( !_.contains( [
				CONSTANTS.PURCHASE_ORDER_STATUS.CANCELLED,
				CONSTANTS.PURCHASE_ORDER_STATUS.WAITING_APPROVAL,
			], data.status ) ) {
				deferred.resolve({
					status	: false,
					message	: 'PURCHASE_ORDER_STATUS_INVALID',
				});
				return deferred.promise;
			}

			// If approved PO, could not change status
			const transaction = await new Model( this.channelId ).transaction();
			const projectPurchaseOrderRepository = new ProjectPurchaseOrderRepository( this.channelId );
			const projectPurchaseOrder = await projectPurchaseOrderRepository.getOne( {
				where: { id },
				transaction,
			} );

			if ( !projectPurchaseOrder || projectPurchaseOrder.status === CONSTANTS.PURCHASE_ORDER_STATUS.APPROVED ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'PURCHASE_ORDER_STATUS_INVALID',
				});
				return deferred.promise;
			}

			const project = await new ProjectRepository( this.channelId ).getOne( {
				where: { id: projectPurchaseOrder.project_id },
				transaction,
			} );

			if ( !project || project.purchase_by !== this.currentUser.id ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'PURCHASE_ORDER_STATUS_INVALID',
				});
				return deferred.promise;
			}

			const updateData = { status: data.status };

			if ( data.status === CONSTANTS.PURCHASE_ORDER_STATUS.CANCELLED
				&& projectPurchaseOrder.status === CONSTANTS.PURCHASE_ORDER_STATUS.MODIFIED ) {

				updateData.status = CONSTANTS.PURCHASE_ORDER_STATUS.APPROVED;
				updateData.discount_amount = projectPurchaseOrder.discount_amount_bk;
				updateData.discount_type = projectPurchaseOrder.discount_type_bk;
				updateData.old_data = null;
				updateData.new_data = null;

				const projectCostItemRepository = new ProjectCostItemRepository( this.channelId );
				const projectCostItemResultRemove = await projectCostItemRepository.update(
					{
						project_purchase_order_id: null,
					},
					{
						where: { project_purchase_order_id: projectPurchaseOrder.id },
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

				const projectCostItemResultAdd = await projectCostItemRepository.bulkUpdate(
					{
						project_purchase_order_id: projectPurchaseOrder.id,
					},
					{
						where: {
							id: {
								[ Op.in ]: _.map( JSON.parse( projectPurchaseOrder.old_data ), 'id' ),
							},
						},
						transaction,
					}
				);

				if ( !projectCostItemResultAdd || !projectCostItemResultAdd.status ) {
					// Rollback transaction
					transaction.rollback();

					deferred.resolve({
						status	: false,
						message	: 'UPDATE_COST_ITEM_FAIL',
					});
					return deferred.promise;
				}
			}

			// Process updating status
			const changeStatusResult = await projectPurchaseOrderRepository.update(
				updateData,
				{ where: { id }, transaction }
			);

			if ( !changeStatusResult || !changeStatusResult.status ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'CHANGE_PURCHASE_ORDER_STATUS_FAIL',
				});
				return deferred.promise;
			}

			// When submit / resubmit collect approvers and set to approve table
			if ( data.status === CONSTANTS.PURCHASE_ORDER_STATUS.WAITING_APPROVAL ) {
				const setApproverResult = await this._setApprover( id, project, transaction );

				if ( !setApproverResult || !setApproverResult.status ) {
					// Rollback transaction
					transaction.rollback();

					deferred.resolve({
						status	: false,
						message	: 'CHANGE_PURCHASE_ORDER_STATUS_FAIL',
					});
					return deferred.promise;
				}

			}

			// Commit transaction
			transaction.commit();

			deferred.resolve({
				status	: true,
				message	: 'CHANGE_PURCHASE_ORDER_STATUS_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle freeze
	* @param {int} id
	* @param {object} data
	* @return {promise}
	*/
	async handleChangeFreeze( id, data ) {
		const deferred = Q.defer();

		try {
			// Prevent directly change status except WAITING_APPROVAL & CANCELLED
			if ( !_.contains( [
				CONSTANTS.PURCHASE_ORDER_STATUS.FREEZED,
				CONSTANTS.PURCHASE_ORDER_STATUS.DEFROST,
			], data.status ) ) {
				deferred.resolve({
					status	: false,
					message	: 'PURCHASE_ORDER_STATUS_INVALID',
				});
				return deferred.promise;
			}
			const projectPurchaseOrderRepository = new ProjectPurchaseOrderRepository( this.channelId );
			const projectPurchaseOrder = await projectPurchaseOrderRepository.getOne({
				where: { id },
			});

			if ( !projectPurchaseOrder || !projectPurchaseOrder.id ) {
				deferred.resolve({
					status	: false,
					message	: 'PURCHASE_ORDER_STATUS_INVALID',
				});
				return deferred.promise;
			}

			const updateData = {};

			if ( data.status === CONSTANTS.PURCHASE_ORDER_STATUS.FREEZED ) {
				updateData.old_status = projectPurchaseOrder.status;
				updateData.status = CONSTANTS.PURCHASE_ORDER_STATUS.FREEZED;
			} else {
				updateData.old_status = null;
				updateData.status = projectPurchaseOrder.old_status;
			}

			return projectPurchaseOrderRepository.update(
				updateData,
				{ where: { id } }
			);

		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle _setApprover
	* @param {int} id - Project bill id
	* @param {object} project
	* @param {object} transaction
	* @return {promise}
	*/
	async _setApprover( id, project, transaction ) {
		const deferred = Q.defer();

		try {
			const userRepository = new UserRepository( this.channelId );
			// collect approvers
			const procurementManager = await userRepository.getOne( {
				where: {
					role_key: 'PROCUREMENT_MANAGER',
					is_disabled: false,
				},
				transaction,
			} );

			if ( !project || !project.manage_by || !procurementManager || !procurementManager.id ) {
				deferred.resolve({
					status	: false,
					message	: 'PROCUMENT_NOT_FOUND',
				});
				return deferred.promise;
			}

			const manageBy = await userRepository.getOne( {
				where: {
					id			: project.manage_by,
					is_disabled	: false,
				},
				transaction,
			} );

			if ( !manageBy || !manageBy.id ) {
				deferred.resolve({
					status	: false,
					message	: 'PM_NOT_FOUND',
				});
				return deferred.promise;
			}

			let totalPurchaseOrder = 0;
			const projectCostItems = await new ProjectCostItemRepository( this.channelId ).getAll( {
				where: { project_purchase_order_id: id },
				include: {
					model	: await ProjectCostModification( this.channelId ),
					where	: { status: CONSTANTS.COST_MODIFICATION_STATUS.WAITING },
					required: false,
				},
				transaction,
			} );
			const approvers = [
				{
					status						: CONSTANTS.PURCHASE_ORDER_APPROVE_STATUS.WAITING_APPROVAL,
					role_key					: manageBy.role_key,
					user_id						: manageBy.id,
					project_purchase_order_id	: id,
				},
				{
					status						: CONSTANTS.PURCHASE_ORDER_APPROVE_STATUS.WAITING_APPROVAL,
					role_key					: procurementManager.role_key,
					project_purchase_order_id	: id,
				},
			];

			if ( !projectCostItems || _.find( projectCostItems, item => {
				if ( item.project_cost_modifications.length ) return item;
			} ) ) {
				deferred.resolve({
					status	: false,
					message	: 'PO_HAS_COST_MODIFICATION_ITEMS',
				});
				return deferred.promise;
			}
			_.each( projectCostItems, item => {
				totalPurchaseOrder += item.amount * item.price;
			} );

			if ( project.max_po_price && totalPurchaseOrder >= project.max_po_price ) {
				const ceo = await userRepository.getOne( {
					where: {
						role_key: 'CEO',
						is_disabled: false,
					},
					transaction,
				} );

				if ( !ceo || !ceo.id ) {
					deferred.resolve({
						status	: false,
						message	: 'CEO_NOT_FOUND',
					});
					return deferred.promise;
				}
				approvers.push( {
					status						: CONSTANTS.PURCHASE_ORDER_APPROVE_STATUS.WAITING_APPROVAL,
					role_key					: ceo.role_key,
					project_purchase_order_id	: id,
				} );
			}

			const purchaseOrderApproverRepository = new PurchaseOrderApproverRepository( this.channelId );
			const getApprovers = await purchaseOrderApproverRepository.getAll( {
				where: { project_purchase_order_id: id },
				transaction,
			} );

			if ( !getApprovers ) {
				deferred.resolve({
					status	: false,
					message	: 'COULD_NOT_GET_OLD_APPROVERS',
				});
				return deferred.promise;
			}

			if ( getApprovers.length ) {
				const deleteApprovers = await purchaseOrderApproverRepository.bulkDelete( {
					where: { project_purchase_order_id: id },
					transaction,
				} );

				if ( !deleteApprovers || !deleteApprovers.status ) {
					deferred.resolve({
						status	: false,
						message	: 'COULD_NOT_REMOVE_OLD_APPROVERS',
					});
				}
			}

			const addApprovers = await purchaseOrderApproverRepository.bulkCreate(
				approvers,
				{ transaction }
			);

			if ( !addApprovers ) {
				deferred.resolve({
					status	: false,
					message	: 'COULD_NOT_ADD_NEW_APPROVERS',
				});
			}

			deferred.resolve({
				status	: true,
				message	: 'COMPLETED',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle delete
	* @param {int} id - Project bill id
	* @return {promise}
	*/
	async handleDelete( id ) {
		const deferred = Q.defer();

		try {
			const transaction = await new Model( this.channelId ).transaction();
			const projectPurchaseOrderRepository = new ProjectPurchaseOrderRepository( this.channelId );
			const result = await projectPurchaseOrderRepository.getOne({
				where: { id },
				include: { model: await ProjectPayment( this.channelId ) },
				transaction,
			});

			if ( !result
				|| result.status === CONSTANTS.PURCHASE_ORDER_STATUS.WAITING_APPROVAL
				|| ( result.project_payments
					&& result.project_payments.length ) ) {
				// Rollback transaction
				transaction.rollback();

				deferred.reject({
					status	: STATUS_CODE.BAD_REQUEST,
					message	: STATUS_MESSAGE.BAD_REQUEST,
				});
				return deferred.promise;
			}

			const project = await new ProjectRepository( this.channelId ).getOne( {
				where: { id: result.project_id },
				transaction,
			} );

			if ( !project || project.purchase_by !== this.currentUser.id ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'DELETE_PURCHASE_ORDER_FAIL',
				});
				return deferred.promise;
			}

			const resultDelete = await projectPurchaseOrderRepository.delete( { where: { id }, transaction } );

			if ( !resultDelete || !resultDelete.status ) {
				// Rollback transaction
				transaction.rollback();

				deferred.reject({
					status	: STATUS_CODE.BAD_REQUEST,
					message	: STATUS_MESSAGE.BAD_REQUEST,
				});
				return deferred.promise;
			}

			// Commit transaction
			transaction.commit();

			deferred.resolve({
				status	: true,
				message	: 'DELETE_PURCHASE_ORDER_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

}

module.exports = ProjectPurchaseOrderHandler;
