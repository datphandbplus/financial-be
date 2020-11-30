const Q = require( 'q' );
const _ = require( 'underscore' );
const Sequelize = require( 'sequelize' );
const moment = require( 'moment-timezone' );

const Vendor = require( '@models/finance/vendor/vendor' );
const User = require( '@models/finance/user/user' );
const UserRepository = require( '@models/finance/user/user_repository' );
const ProjectCostItemRepository = require( '@models/finance/project/project_cost_item_repository' );
const Project = require( '@models/finance/project/project' );
const ProjectRepository = require( '@models/finance/project/project_repository' );
const ProjectPaymentRepository = require( '@models/finance/project/project_payment_repository' );
const ProjectPurchaseOrder = require( '@models/finance/project/project_purchase_order' );
const ProjectPurchaseOrderRepository = require( '@models/finance/project/project_purchase_order_repository' );
const ProjectPaymentApprover = require( '@models/finance/project/project_payment_approver' );
const ProjectPaymentApproverRepository = require( '@models/finance/project/project_payment_approver_repository' );

const {
	Logger, Account,
	Uploader, Model,
} = require( '@helpers' );
const { STATUS_CODE, STATUS_MESSAGE, CONSTANTS } = require( '@resources' );

const Op = Sequelize.Op;

class ProjectPaymentHandler {

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
	* Handle get project payments
	* @param {object} queryOptions
	* @return {promise}
	*/
	async handleGetAll( queryOptions = {} ) {
		const deferred = Q.defer();

		try {
			const options = { where: {}, include: [] };

			if ( queryOptions && queryOptions.project_id ) {
				options.where.project_id = queryOptions.project_id;

				if ( queryOptions.query_for === 'payable' ) {
					options.include.push({
						model		: await ProjectPurchaseOrder( this.channelId ),
						attributes	: [ 'id', 'name', 'status' ],
						include: {
							model		: await Vendor( this.channelId ),
							attributes	: [ 'id', 'is_disabled' ],
						},
					});
				}

				options.include.push(
					{
						model		: await Project( this.channelId ),
						attributes	: [ 'id', 'quotation_status' ],
					},
					{
						model: await ProjectPaymentApprover( this.channelId ),
						attributes: [
							'id', 'user_id', 'role_key',
							'status', 'comment',
						],
						include: {
							model		: await User( this.channelId ),
							attributes	: [ 'id', 'full_name', 'role_key' ],
						},
					}
				);

				if ( this.account.isPM() ) {
					options.where[ Op.and ] = [
						Sequelize.where(
							Sequelize.col( 'project.manage_by' ),
							this.currentUser.id
						),
					];
				}

				if ( this.account.isConstruction() ) {
					options.where[ Op.and ] = [
						Sequelize.where(
							Sequelize.col( 'project.construct_by' ),
							this.currentUser.id
						),
					];
				}
			}

			// Prevent get all bills if user is not CEO
			if ( !this.account.isCEO() && ( !_.keys( options.where ).length || !options.include.length ) ) {
				deferred.reject({
					status	: STATUS_CODE.BAD_REQUEST,
					message	: STATUS_MESSAGE.BAD_REQUEST,
				});
				return deferred.promise;
			}

			// In case user is General Accountant then only get payment WAITING_APPROVAL or APPROVED
			if ( this.account.isGeneralAccountant() ) {
				options.where.approve_status = {
					[ Op.in ]: [
						CONSTANTS.PAYMENT_APPROVE_STATUS.WAITING_APPROVAL,
						CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED,
					],
				};
			}

			// In case user is Liabilities Accountant then only get payment APPROVED
			if ( this.account.isLiabilitiesAccountant() ) {
				options.where.approve_status = CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED;
			}

			// In case user is Construction or Construction Manager then only get payment APPROVED and PAID
			if ( this.account.isConstruction() || this.account.isConstructionManager() ) {
				options.where.approve_status = CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED;
				options.where.status = CONSTANTS.PAYMENT_STATUS.PAID;
			}

			return new ProjectPaymentRepository( this.channelId ).getAll( options );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle get all payables
	* @param {object} queryOptions
	* @return {promise}
	*/
	async handleGetAllPayables( queryOptions = {} ) {
		const deferred = Q.defer();

		try {
			const options = {
				attributes: [
					'id', 'invoice_date', 'vendor_name',
					'name', 'paid_date', 'status',
					'vendor_payment_term', 'invoices',
					'payment_orders', 'payment_order_date', 'approve_status',
					'total', 'total_vat',
					'total_real', 'total_vat_real',
				],
				include: [
					{
						model		: await Project( this.channelId ),
						attributes	: [ 'id', 'name' ],
						include: {
							model: await User( this.channelId ),
							attributes: [
								'id', 'full_name', 'is_disabled',
								'avatar', 'email',
							],
						},
					},
					{
						model		: await ProjectPurchaseOrder( this.channelId ),
						attributes	: [ 'id' ],
						include: {
							model		: await Vendor( this.channelId ),
							attributes	: [ 'id', 'short_name', 'is_disabled' ],
						},
					},
					{
						model		: await ProjectPaymentApprover( this.channelId ),
						attributes	: [ 'id', 'role_key', 'status' ],
						where		: { role_key: 'PROCUREMENT_MANAGER' },
					},
				],
				where: {
					[ Op.and ]: [
						Sequelize.where(
							Sequelize.col( 'project.quotation_status' ),
							CONSTANTS.QUOTATION_STATUS.APPROVED
						),
					],
				},
				group: [ 'id', 'project_purchase_order_id' ],
			};

			// In case user is PM then only get payment of own project
			if ( this.account.isPM() ) {
				options.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.manage_by' ),
						this.currentUser.id
					)
				);
			}

			// In case user is Construction then only get payment of own project
			if ( this.account.isConstruction() ) {
				options.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.construct_by' ),
						this.currentUser.id
					)
				);
			}

			// In case user is Liabilities Accountant then only get payment APPROVE_STATUS is APPROVED
			if ( this.account.isLiabilitiesAccountant() ) {
				options.where.approve_status = CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED;
			}

			// In case user is Construction or Construction Manager then only get payment APPROVED and PAID
			if ( this.account.isConstruction() || this.account.isConstructionManager() ) {
				options.where.approve_status = CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED;
				options.where.status = CONSTANTS.PAYMENT_STATUS.PAID;
			}

			if ( queryOptions ) {
				// Filter by invoice date
				if ( queryOptions.invoice_date_start && queryOptions.invoice_date_end ) {
					const startDate = moment( +queryOptions.invoice_date_start );
					const endDate = moment( +queryOptions.invoice_date_end );

					options.where.invoice_date = {
						[ Op.gte ]: startDate.format(),
						[ Op.lte ]: endDate.format(),
					};
				}
			}

			return new ProjectPaymentRepository( this.channelId ).getAll( options );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle create project payment
	* @param {object} data - Project payment data
	* @return {promise}
	*/
	async handleCreate( data ) {
		const deferred = Q.defer();

		try {
			const projectId = data.project_id;
			const projectPOId = data.project_purchase_order_id;

			// Check project valid
			await this._checkProjectValid( projectId );

			const projectPO = await new ProjectPurchaseOrderRepository( this.channelId ).getOne({
				attributes: [
					'id', 'vat_percent',
					[ Sequelize.col( 'vendor.short_name' ), 'vendor_name' ],
					[ Sequelize.col( 'vendor.payment_term' ), 'vendor_payment_term' ],
				],
				where: {
					id			: projectPOId,
					project_id	: projectId,
					status		: CONSTANTS.PURCHASE_ORDER_STATUS.APPROVED,
				},
				include: {
					model		: await Vendor( this.channelId ),
					attributes	: [],
					require		: true,
				},
			});

			if ( !projectPO || !projectPO.id ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: 'PROJECT_PURCHASE_ORDER_INVALID',
				});
				return deferred.promise;
			}

			// Create project
			const newInvoice = data.new_invoice;
			const createData = {
				project_purchase_order_id	: projectPOId,
				project_id					: projectId,
				name						: data.name,
				total						: +data.total,
				total_vat					: +data.total_vat,
				vendor_name					: projectPO.dataValues.vendor_name,
				vendor_payment_term			: +projectPO.dataValues.vendor_payment_term,
				invoice_number				: data.invoice_number,
				invoice_date				: data.invoice_date,
				transfer_type				: data.transfer_type,
			};

			if ( newInvoice ) {
				createData.invoices = [
					{
						location	: newInvoice.location,
						path		: newInvoice.path,
						key			: newInvoice.key,
						note		: newInvoice.note,
						created_at	: moment(),
					},
				];
			}

			const totalCostItem = await this._checkTotalCostItem( projectId, projectPOId );
			const maxTotalVat = totalCostItem.data.total * projectPO.dataValues.vat_percent / 100;

			if ( createData.total > totalCostItem.data.total - totalCostItem.data.total_planed ) {
				deferred.resolve({
					status	: false,
					message	: 'PROJECT_PAYMENT_OVER',
				});
				return deferred.promise;
			}

			if ( createData.total_vat > maxTotalVat - totalCostItem.data.total_vat_planed ) {
				deferred.resolve({
					status	: false,
					message	: 'PROJECT_PAYMENT_VAT_OVER',
				});
				return deferred.promise;
			}

			const transaction = await new Model( this.channelId ).transaction();
			const result = await new ProjectPaymentRepository( this.channelId ).create( createData, { transaction } );

			if ( !result || !result.status ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve( result );
				return deferred.promise;
			}

			const paymentId = result.data.id;
			const paymentApprovers = await new ProjectPaymentApproverRepository( this.channelId )
			.bulkCreate([
				{
					project_payment_id	: paymentId,
					role_key			: 'PROCUREMENT_MANAGER',
					status				: CONSTANTS.PAYMENT_APPROVE_STATUS.WAITING_APPROVAL,
				},
				{
					project_payment_id	: paymentId,
					role_key			: 'GENERAL_ACCOUNTANT',
					status				: CONSTANTS.PAYMENT_APPROVE_STATUS.WAITING_APPROVAL,
				},
				{
					project_payment_id	: paymentId,
					role_key			: 'CFO',
					status				: CONSTANTS.PAYMENT_APPROVE_STATUS.WAITING_APPROVAL,
				},
			], { transaction });

			if ( !paymentApprovers || !paymentApprovers.status ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve( paymentApprovers );
				return deferred.promise;
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

	/**
	* Handle update project payment invoice
	* @param {int} id - Project payment id
	* @param {object} data - Project payment data
	* @return {promise}
	*/
	async handleUpdateInvoice( id, data ) {
		const deferred = Q.defer();

		try {
			// Check project payment valid
			const result = await this._checkProjectPaymentValid(
				id,
				[ CONSTANTS.PAYMENT_STATUS.WAITING ],
				[ 'invoices' ]
			);
			const updateData = {
				invoice_date	: data.invoice_date,
				invoice_number	: data.invoice_number,
			};
			const updateOptions = {
				where: {
					id,
					status: CONSTANTS.PAYMENT_STATUS.WAITING,
				},
			};
			const invoices = result.data.invoices || [];
			const newInvoice = data.new_invoice;

			if ( newInvoice ) {
				invoices.unshift({
					location	: newInvoice.location,
					path		: newInvoice.path,
					key			: newInvoice.key,
					note		: newInvoice.note,
					created_at	: moment(),
				});
			}

			updateData.invoices = invoices;

			return new ProjectPaymentRepository( this.channelId ).update( updateData, updateOptions );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update project payment order
	* @param {int} id - Project payment id
	* @param {object} data - Project payment data
	* @return {promise}
	*/
	async handleUpdatePaymentOrder( id, data ) {
		const deferred = Q.defer();

		try {
			// Check project payment valid
			const result = await this._checkProjectPaymentValid(
				id,
				[ CONSTANTS.PAYMENT_STATUS.CONFIRMED ],
				[ 'payment_orders' ]
			);
			const updateData = {
				payment_order_date	: data.payment_order_date,
				payment_order_number: data.payment_order_number,
			};
			const updateOptions = {
				where: {
					id,
					status: {
						[ Op.in ]: [ CONSTANTS.PAYMENT_STATUS.CONFIRMED ],
					},
				},
			};
			const paymentOrders = result.data.payment_orders || [];
			const newPaymentOrder = data.new_payment_order;

			if ( newPaymentOrder ) {
				paymentOrders.unshift({
					location	: newPaymentOrder.location,
					path		: newPaymentOrder.path,
					key			: newPaymentOrder.key,
					note		: newPaymentOrder.note,
					created_at	: moment(),
				});
			}

			updateData.payment_orders = paymentOrders;

			return new ProjectPaymentRepository( this.channelId ).update( updateData, updateOptions );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update project payment status
	* @param {int} id - Project bill id
	* @param {object} data - Project bill data
	* @return {promise}
	*/
	async handleUpdateStatus( id, data ) {
		const deferred = Q.defer();

		try {
			// Check project bill valid
			const result = await this._checkProjectPaymentValid(
				id,
				null,
				[ 'payment_orders', 'approve_status' ]
			);
			const paymentStatus = +data.status;
			const updateData = { status: paymentStatus };
			const updateOptions = {
				where: { id },
			};

			// In case update status is 'PAID'
			if ( _.contains( [ CONSTANTS.PAYMENT_STATUS.PAID ], paymentStatus ) ) {
				const totalReal = data.total_real;
				const totalVATReal = data.total_vat_real;
				// But Approve Status is not 'APPROVED' or total real or total vat real invalid
				if ( ( result.data.approve_status !== CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED )
					|| ( isNaN( totalReal ) || isNaN( totalVATReal ) || totalReal < 0 || totalVATReal < 0 ) ) {
					deferred.reject({
						status	: STATUS_CODE.BAD_REQUEST,
						message	: STATUS_MESSAGE.BAD_REQUEST,
					});
					return deferred.promise;
				}

				updateData.total_real = +totalReal;
				updateData.total_vat_real = +totalVATReal;
				updateData.paid_date = moment();
			}

			return new ProjectPaymentRepository( this.channelId ).update( updateData, updateOptions );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update project payment approve status
	* @param {int} id - Project bill id
	* @param {object} data - Project bill data
	* @return {promise}
	*/
	async handleUpdateApproveStatus( id, data ) {
		const deferred = Q.defer();

		try {
			// Check project bill valid
			const projectPayment = await this._checkProjectPaymentValid(
				id,
				null,
				[
					'status', 'approve_status',
					'total_real', 'total_vat_real',
				]
			);
			const projectId = projectPayment.data.project_id;
			const projectPOId = projectPayment.data.project_purchase_order_id;

			// Check project is valid
			await this._checkProjectValid( projectId );

			// In case Status is not 'WAITING'
			// or is not CEO and Approve Status is 'APPROVED'
			if ( projectPayment.data.status !== CONSTANTS.PAYMENT_STATUS.WAITING
				|| ( !this.account.isCEO()
					&& projectPayment.data.approve_status === CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED ) ) {
				deferred.reject({
					status	: STATUS_CODE.BAD_REQUEST,
					message	: STATUS_MESSAGE.BAD_REQUEST,
				});
				return deferred.promise;
			}

			const transaction = await new Model( this.channelId ).transaction();
			const projectPaymentApproverRepository = new ProjectPaymentApproverRepository( this.channelId );
			const approveStatus = +data.status;

			// CEO can update CANCELLED only
			// PM or Purchasing can update WAITING_APPROVAL or CANCELLED only
			if ( this.account.isCEO() || this.account.isPM() || this.account.isPurchasing() ) {
				const approveStatusToCheck = this.account.isCEO()
					? [ CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED ]
					: [
						CONSTANTS.PAYMENT_APPROVE_STATUS.PROCESSING,
						CONSTANTS.PAYMENT_APPROVE_STATUS.WAITING_APPROVAL,
						CONSTANTS.PAYMENT_APPROVE_STATUS.CANCELLED,
					];
				const validApproveStatus = this.account.isCEO()
					? [ CONSTANTS.PAYMENT_APPROVE_STATUS.CANCELLED ]
					: [ CONSTANTS.PAYMENT_APPROVE_STATUS.WAITING_APPROVAL, CONSTANTS.PAYMENT_APPROVE_STATUS.CANCELLED ];

				if ( !_.contains( approveStatusToCheck, projectPayment.data.approve_status )
					|| !_.contains( validApproveStatus, approveStatus ) ) {
					// Rollback transaction
					transaction.rollback();

					deferred.reject({
						status	: STATUS_CODE.BAD_REQUEST,
						message	: STATUS_MESSAGE.BAD_REQUEST,
					});
					return deferred.promise;
				}

				// Update approve status
				const result = await this._updatePaymentApproveStatus( id, approveStatus, transaction );

				if ( !result || !result.status ) {
					// Rollback transaction
					transaction.rollback();

					deferred.resolve( result );
					return deferred.promise;
				}

				// Reset approver status when submit payment, reset user_id
				if ( approveStatus !== CONSTANTS.PAYMENT_APPROVE_STATUS.WAITING_APPROVAL ) {
					const updateAproversResult = await projectPaymentApproverRepository
					.bulkUpdate(
						{
							user_id	: null,
							status	: CONSTANTS.PAYMENT_APPROVE_STATUS.WAITING_APPROVAL,
						},
						{
							where: { project_payment_id: id },
							transaction,
						}
					);

					if ( !updateAproversResult || !updateAproversResult.status ) {
						// Rollback transaction
						transaction.rollback();

						deferred.resolve( updateAproversResult );
						return deferred.promise;
					}
				}

				// Commit transaction
				transaction.commit();

				deferred.resolve( result );
				return deferred.promise;
			}

			// ProcurementManager can update APPROVED or REJECTED only
			if ( this.account.isProcurementManager() || this.account.isCFO() || this.account.isGeneralAccountant() ) {
				if ( !_.contains(
					[ CONSTANTS.PAYMENT_APPROVE_STATUS.WAITING_APPROVAL, CONSTANTS.PAYMENT_APPROVE_STATUS.REJECTED ],
					projectPayment.data.approve_status )
					|| !_.contains(
						[ CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED, CONSTANTS.PAYMENT_APPROVE_STATUS.REJECTED ],
						approveStatus )
				) {
					// Rollback transaction
					transaction.rollback();

					deferred.reject({
						status	: STATUS_CODE.BAD_REQUEST,
						message	: STATUS_MESSAGE.BAD_REQUEST,
					});
					return deferred.promise;
				}
			}

			const updateData = {
				user_id		: this.currentUser.id,
				status		: approveStatus,
				comment		: data.comment,
				approved_at	: moment(),
			};
			const updateOptions = {
				where: {
					project_payment_id	: id,
					role_key			: this.currentUser.role_key,
					user_id: {
						[ Op.or ]: [ null, this.currentUser.id ],
					},
				},
				transaction,
			};

			// CFO or General Account only update after Procurement Manager APPROVED
			if ( this.account.isCFO() || this.account.isGeneralAccountant() ) {
				// Get Procurement Manager decision
				const procurementManagerDecision = await projectPaymentApproverRepository.getOne({
					attributes: [ 'id', 'status' ],
					where: {
						project_payment_id	: id,
						role_key			: 'PROCUREMENT_MANAGER',
						status				: CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED,
					},
					transaction,
				});

				if ( !procurementManagerDecision ) {
					// Rollback transaction
					transaction.rollback();

					deferred.reject({
						status	: STATUS_CODE.BAD_REQUEST,
						message	: 'PROCUREMENT_MANAGER_NOT_APPROVED',
					});
					return deferred.promise;
				}
			}

			// Update approver decision
			const result = await projectPaymentApproverRepository.update( updateData, updateOptions );

			if ( !result || !result.status ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve( result );
				return deferred.promise;
			}

			// Check all approver's decisions when change to APPROVED
			if ( approveStatus === CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED ) {
				// Approver by Procurement Manager set Total real and Total VAT real
				if ( this.account.isProcurementManager() ) {
					const totalReal = data.total_real;
					const totalVATReal = data.total_vat_real;

					if ( isNaN( totalReal ) || isNaN( totalVATReal ) || totalReal < 0 || totalVATReal < 0 ) {
						// Rollback transaction
						transaction.rollback();

						deferred.reject({
							status	: STATUS_CODE.BAD_REQUEST,
							message	: STATUS_MESSAGE.BAD_REQUEST,
						});
						return deferred.promise;
					}

					const totalCostItem = await this._checkTotalCostItem( projectId, projectPOId );
					const maxTotalVat = totalCostItem.data.total
						* ( projectPayment.data.dataValues
							&& projectPayment.data.dataValues.project_purchase_order
							&& projectPayment.data.dataValues.project_purchase_order.vat_percent || 0 )
						/ 100;
					const currTotalReal = projectPayment.data && projectPayment.data.dataValues.total_real || 0;
					const currTotalVATReal = projectPayment.data && projectPayment.data.dataValues.total_vat_real || 0;

					if ( totalReal > totalCostItem.data.total - totalCostItem.data.total_real + currTotalReal ) {
						// Rollback transaction
						transaction.rollback();

						deferred.resolve({
							status	: false,
							message	: 'PROJECT_PAYMENT_OVER',
						});
						return deferred.promise;
					}

					if ( totalVATReal > maxTotalVat - totalCostItem.data.total_vat_real + currTotalVATReal ) {
						// Rollback transaction
						transaction.rollback();

						deferred.resolve({
							status	: false,
							message	: 'PROJECT_PAYMENT_VAT_OVER',
						});
						return deferred.promise;
					}

					const updatePaymentRealResult = await this
					._updatePaymentTotalAndTotalVATReal( id, +totalReal, +totalVATReal, transaction );

					if ( !updatePaymentRealResult || !updatePaymentRealResult.status ) {
						// Rollback transaction
						transaction.rollback();

						deferred.resolve( updatePaymentRealResult );
						return deferred.promise;
					}
				} else { // Count approver decisions to set payment approve status
					const approverDecisions = await projectPaymentApproverRepository.getAll({
						attributes: [ 'id', 'status' ],
						where: {
							project_payment_id	: id,
							status				: CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED,
							role_key: {
								[ Op.or ]: [ 'PROCUREMENT_MANAGER', 'CFO' ],
							},
						},
						transaction,
					});

					// Procurement Manager and CFO APPROVED -> Change Approve Status to APPROVED
					if ( approverDecisions && approverDecisions.length === 2 ) {
						const updatePaymentResult = await this
						._updatePaymentApproveStatus( id, CONSTANTS.QUOTATION_STATUS.APPROVED, transaction );

						if ( !updatePaymentResult || !updatePaymentResult.status ) {
							// Rollback transaction
							transaction.rollback();

							deferred.resolve( updatePaymentResult );
							return deferred.promise;
						}
					}
				}
			} else { // Reject
				// Reject by Procurement Manager set Total real and Total VAT real 0
				if ( this.account.isProcurementManager() ) {
					const updatePaymentRealResult = await this
					._updatePaymentTotalAndTotalVATReal( id, 0, 0, transaction );

					if ( !updatePaymentRealResult || !updatePaymentRealResult.status ) {
						// Rollback transaction
						transaction.rollback();

						deferred.resolve( updatePaymentRealResult );
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

	/**
	* Handle update project bill procedures
	* @param {int} id - Project bill id
	* @param {object} data - Project bill data
	* @return {promise}
	*/
	async handleUpdateProcedures( id, data ) {
		const deferred = Q.defer();

		try {
			// Check project payment valid
			await this._checkProjectPaymentValid(
				id,
				[ CONSTANTS.PAYMENT_STATUS.WAITING ]
			);

			const procedureData = _.map( data, item => {
				return {
					name		: item.name,
					deadline	: item.deadline,
					status		: item.status,
					proof		: item.proof,
					note		: item.note,
					created_at	: item.created_at,
				};
			} );

			const updateData = { procedures: JSON.stringify( procedureData ) };
			const updateOptions = {
				where: { id },
			};

			return new ProjectPaymentRepository( this.channelId ).update( updateData, updateOptions );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update project payment finance note
	* @param {int} id - Project payment id
	* @param {object} data - Project payment data
	* @return {promise}
	*/
	async handleUpdateFinanceNote( id, data ) {
		const deferred = Q.defer();

		try {
			const statusArr = [];

			_.mapObject( CONSTANTS.BILL_STATUS, ( val, key ) => {
				if ( key !== 'MONEY_COLLECTED' ) statusArr.push( val );
			} );

			// Check project bill valid
			await this._checkProjectPaymentValid( id, statusArr );

			const updateData = { finance_note: data.finance_note };
			const updateOptions = {
				where: { id },
			};

			return new ProjectPaymentRepository( this.channelId ).update( updateData, updateOptions );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle delete project payment
	* @param {int} id
	* @return {promise}
	*/
	async handleDelete( id ) {
		const deferred = Q.defer();

		try {
			// Check project payment valid
			await this._checkProjectPaymentValid( id );

			const projectPaymentRepository = new ProjectPaymentRepository( this.channelId );
			const options = {
				attributes: [ 'id' ],
				where: {
					id,
					status: CONSTANTS.PAYMENT_STATUS.WAITING,
				},
				include: {
					model		: await Project( this.channelId ),
					attributes	: [],
					where		: { quotation_status: CONSTANTS.QUOTATION_STATUS.APPROVED },
				},
			};

			if ( this.account.isPM() ) options.include.where.manage_by = this.currentUser.id;

			const projectPayment = await projectPaymentRepository.getOne( options );

			if ( !projectPayment || !projectPayment.id ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}

			const deleteOptions = {
				where: {
					id,
					payment_orders		: null,
					payment_order_date	: null,
					payment_order_number: null,
					status				: CONSTANTS.PAYMENT_STATUS.WAITING,
				},
			};

			return projectPaymentRepository.delete( deleteOptions );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle download invoice
	* @param {object} data - Data to download
	* @return {promise}
	*/
	handleDownloadInvoice( data ) {
		const deferred = Q.defer();

		try {
			const url = new Uploader( this.channelId ).download( data );

			if ( !url ) {
				deferred.resolve({
					status	: false,
					message	: 'DOWNLOAD_INVOICE_FAIL',
				});
				return deferred.promise;
			}

			deferred.resolve({
				status	: true,
				message	: 'DOWNLOAD_INVOICE_SUCCESS',
				data	: url,
			});
		} catch ( error ) {
			new Logger().write( 'error', error, this.channelId );
			deferred.reject( error );
		}

		return deferred.promise;
	}

	/**
	* Handle download payment order
	* @param {object} data - Data to download
	* @return {promise}
	*/
	handleDownloadPaymentOrder( data ) {
		const deferred = Q.defer();

		try {
			const url = new Uploader( this.channelId ).download( data );

			if ( !url ) {
				deferred.resolve({
					status	: false,
					message	: 'DOWNLOAD_PAYMENT_ORDER_FAIL',
				});
				return deferred.promise;
			}

			deferred.resolve({
				status	: true,
				message	: 'DOWNLOAD_PAYMENT_ORDER_SUCCESS',
				data	: url,
			});
		} catch ( error ) {
			new Logger().write( 'error', error, this.channelId );
			deferred.reject( error );
		}

		return deferred.promise;
	}

	/**
	* Handle download procedure
	* @param {object} data - Data to download
	* @return {promise}
	*/
	handleDownloadProcedure( data ) {
		const deferred = Q.defer();

		try {
			const url = new Uploader( this.channelId ).download( data );

			if ( !url ) {
				deferred.resolve({
					status	: false,
					message	: 'DOWNLOAD_PROCEDURE_FAIL',
				});
				return deferred.promise;
			}

			deferred.resolve({
				status	: true,
				message	: 'DOWNLOAD_PROCEDURE_SUCCESS',
				data	: url,
			});
		} catch ( error ) {
			new Logger().write( 'error', error, this.channelId );
			deferred.reject( error );
		}

		return deferred.promise;
	}

	/**
	* Handle get total purchase order
	* @param {object} queryOptions
	* @return {promise}
	*/
	async handleGetTotalPO( queryOptions = {} ) {
		const deferred = Q.defer();

		try {
			const id = queryOptions.project_payment_id;
			// Check project payment valid
			const projectPayment = await this._checkProjectPaymentValid(
				id,
				null,
				[
					'status', 'approve_status',
					'total_real', 'total_vat_real',
				]
			);

			const projectId = queryOptions.project_id;
			const projectPOId = queryOptions.project_purchase_order_id;

			// Check project is valid
			await this._checkProjectValid( projectId );

			if ( !queryOptions.project_id || !queryOptions.project_purchase_order_id ) {
				deferred.resolve({
					status	: true,
					message	: 'PROJECT_INVALID',
					data: {
						total			: 0,
						total_planed	: 0,
						total_vat_planed: 0,
						total_paid		: 0,
						total_vat_paid	: 0,
						total_real		: 0,
						total_vat_real	: 0,
					},
				});
				return deferred.promise;
			}

			const result = await this._checkTotalCostItem( projectId, projectPOId );

			if ( !result || !result.status || !result.data ) {
				deferred.resolve( result );
				return deferred.promise;
			}

			result.data.total_vat = result.data.total
				* ( projectPayment.data.dataValues
					&& projectPayment.data.dataValues.project_purchase_order
					&& projectPayment.data.dataValues.project_purchase_order.vat_percent || 0 )
				/ 100;

			deferred.resolve( result );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Check project bill valid
	* @private
	* @param {int} id - Project bill id
	* @param {Array} status - Project bill status
	* @param {Array} extraAttributes - Project bill extra attributes
	* @return {promise}
	*/
	async _checkProjectPaymentValid( id, status = null, extraAttributes = null ) {
		const deferred = Q.defer();

		try {
			const options = {
				attributes	: _.union( [ 'id', 'project_id', 'project_purchase_order_id' ], extraAttributes ),
				where		: { id },
				include: {
					model		: await ProjectPurchaseOrder( this.channelId ),
					attributes	: [ 'id', 'vat_percent' ],
					where: {
						status: CONSTANTS.PURCHASE_ORDER_STATUS.APPROVED,
					},
				},
			};

			if ( status ) options.where.status = { [ Op.in ]: status };

			const projectPayment = await new ProjectPaymentRepository( this.channelId ).getOne( options );

			if ( !projectPayment ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}

			await this._checkProjectValid( projectPayment.project_id );

			deferred.resolve({
				status	: true,
				message	: 'PROJECT_PAYMENT_VALID',
				data	: projectPayment,
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Check project valid
	* @private
	* @param {int} id - Project id
	* @return {promise}
	*/
	async _checkProjectValid( id ) {
		const deferred = Q.defer();

		try {
			const options = {
				attributes	: [ 'id' ],
				where		: { id, quotation_status: CONSTANTS.QUOTATION_STATUS.APPROVED },
			};

			if ( this.account.isPM() ) options.where.manage_by = this.currentUser.id;
			if ( this.account.isPurchasing() ) options.where.purchase_by = this.currentUser.id;

			const project = await new ProjectRepository( this.channelId ).getOne( options );

			if ( !project ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}

			deferred.resolve({
				status	: true,
				message	: 'PROJECT_VALID',
				data	: project,
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Check total cost item
	* @private
	* @param {int} projectId - Project id
	* @param {int} projectPOId - Project purchase id
	* @return {promise}
	*/
	async _checkTotalCostItem( projectId, projectPOId ) {
		const deferred = Q.defer();

		try {
			const options = {
				attributes: [
					'id',
					[ Sequelize.col( 'project_purchase_order.discount_type' ), 'discount_type' ],
					[ Sequelize.col( 'project_purchase_order.discount_amount' ), 'discount_amount' ],
					[ Sequelize.col( 'project_purchase_order.status' ), 'po_status' ],
					[ Sequelize.fn( 'sum', Sequelize.literal( 'amount * price' ) ), 'total' ],
				],
				where: {
					project_id					: projectId,
					project_purchase_order_id	: projectPOId,
				},
				include: [
					{
						model		: await Project( this.channelId ),
						attributes	: [],
						required	: true,
					},
					{
						model		: await ProjectPurchaseOrder( this.channelId ),
						attributes	: [],
						required	: true,
					},
				],
			};
			const paymentOptions = {
				attributes: [
					'id', 'total', 'total_real',
					'total_vat', 'total_vat_real', 'approve_status',
				],
				where: {
					project_id					: projectId,
					project_purchase_order_id	: projectPOId,
				},
				include: {
					model		: await Project( this.channelId ),
					attributes	: [],
				},
			};

			if ( this.account.isPM() ) {
				options.include.where = { manage_by: this.currentUser.id };
				paymentOptions.include.where = { manage_by: this.currentUser.id };
			}

			if ( this.account.isPurchasing() ) {
				options.include.where = { purchase_by: this.currentUser.id };
				paymentOptions.include.where = { purchase_by: this.currentUser.id };
			}

			const projectCostItem = await new ProjectCostItemRepository( this.channelId ).getOne( options );

			if ( !projectCostItem || projectCostItem.dataValues.po_status !== CONSTANTS.PURCHASE_ORDER_STATUS.APPROVED ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}

			const paymentPlaned = await new ProjectPaymentRepository( this.channelId ).getAll( paymentOptions );
			let totalPaid = 0;
			let totalVATPaid = 0;
			let totalPlaned = 0;
			let totalVATPlaned = 0;
			let totalReal = 0;
			let totalVATReal = 0;

			_.each( paymentPlaned, item => {
				if ( item.approve_status === CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED ) {
					totalPaid += item.total_real;
					totalVATPaid += item.total_vat_real;
				}

				totalPlaned += item.total_real || item.total || 0;
				totalVATPlaned += item.total_vat_real || item.total_vat_real || 0;

				totalReal += item.total_real || 0;
				totalVATReal += item.total_vat_real || 0;
			} );

			const discountAmount = projectCostItem.dataValues.discount_type === '%'
				? projectCostItem.dataValues.total * ( projectCostItem.dataValues.discount_amount || 0 ) / 100
				: ( projectCostItem.dataValues.discount_amount || 0 );

			deferred.resolve({
				status	: true,
				message	: 'PROJECT_VALID',
				data: {
					total			: projectCostItem.dataValues.total - discountAmount,
					total_planed	: totalPlaned,
					total_vat_planed: totalVATPlaned,
					total_paid		: totalPaid,
					total_vat_paid	: totalVATPaid,
					total_real		: totalReal,
					total_vat_real	: totalVATReal,
				},
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Update project payment approve status
	* @private
	* @param {int} id - Project payment id
	* @param {int} status - Approve status
	* @param {any} transaction - Transaction to commit/rollback
	* @return {promise}
	*/
	_updatePaymentApproveStatus( id, status, transaction = null ) {
		const updateData = { approve_status: status };

		// Reset total real and total vat real
		if ( updateData.approve_status === CONSTANTS.PAYMENT_APPROVE_STATUS.CANCELLED ) {
			updateData.total_real = 0;
			updateData.total_vat_real = 0;
		}

		return new ProjectPaymentRepository( this.channelId ).update(
			updateData,
			{
				where: {
					id,
					// approve_status: { [ Op.ne ]: CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED },
				},
				transaction,
			}
		);
	}

	/**
	* Update project payment approve status
	* @private
	* @param {int} id - Project payment id
	* @param {int} totalReal - Total real
	* @param {int} totalVATReal - Total VAT real
	* @param {any} transaction - Transaction to commit/rollback
	* @return {promise}
	*/
	_updatePaymentTotalAndTotalVATReal( id, totalReal, totalVATReal, transaction = null ) {
		return new ProjectPaymentRepository( this.channelId ).update(
			{
				total_real: totalReal,
				total_vat_real: totalVATReal,
			},
			{
				where: {
					id,
					approve_status: { [ Op.ne ]: CONSTANTS.PAYMENT_APPROVE_STATUS.APPROVED },
				},
				transaction,
			}
		);
	}

	/**
	* Check user is role
	* @private
	* @param {string} role - User role
	* @param {any} transaction - Transaction to commit/rollback
	* @return {promise}
	*/
	async _getUserByRole( role, transaction = null ) {
		const deferred = Q.defer();

		try {
			const user = await new UserRepository( this.channelId ).getOne({
				attributes: [ 'id', 'role_key' ],
				where: {
					role_key	: role,
					is_disabled	: false,
				},
				transaction,
			});

			if ( !user ) {
				deferred.resolve({
					status	: false,
					message	: 'USER_ROLE_INVALID',
				});
				return deferred.promise;
			}

			deferred.resolve({
				status	: true,
				message	: 'USER_ROLE_VALID',
				data	: { user_id: user.id },
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

}

module.exports = ProjectPaymentHandler;
