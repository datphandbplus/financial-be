const Q = require( 'q' );
const Sequelize = require( 'sequelize' );

const ProjectRepository = require( '@models/finance/project/project_repository' );
const ProjectApproverRepository = require( '@models/finance/project/project_approver_repository' );
const ProjectPayment = require( '@models/finance/project/project_payment' );
const ProjectPaymentRepository = require( '@models/finance/project/project_payment_repository' );
const ProjectPaymentApproverRepository = require( '@models/finance/project/project_payment_approver_repository' );
const ProjectBillRepository = require( '@models/finance/project/project_bill_repository' );
const ProjectCostModificationRepository = require( '@models/finance/project/project_cost_modification_repository' );
const PurchaseOrderApproverRepository = require( '@models/finance/project/purchase_order_approver_repository' );
const Project = require( '@models/finance/project/project' );
const ProjectPurchaseOrder = require( '@models/finance/project/project_purchase_order' );
const VOApproverRepository = require( '@models/finance/project/vo_approver_repository' );
const ProjectVO = require( '@models/finance/project/project_vo' );

const { Logger, Account } = require( '@helpers' );
const { CONSTANTS } = require( '@resources' );

const Op = Sequelize.Op;

class ProjectWaitingActionHandler {

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
	* Handle get project waiting actions
	* @param {int} id - Project id
	* @param {object} queryOptions
	* @return {promise}
	*/
	async handleGetAll( id, queryOptions = {} ) {
		const deferred = Q.defer();

		try {
			const result = {};
			const isCEO = this.account.isCEO();
			const isPM = this.account.isPM();
			const isSale = this.account.isSale();
			const isProcurementManager = this.account.isProcurementManager();
			const isCFO = this.account.isCFO();
			const isLiabilitiesAccountant = this.account.isLiabilitiesAccountant();
			const isGeneralAccountant = this.account.isGeneralAccountant();

			// Config statistic
			if ( isCEO || isProcurementManager ) {
				result.config_statistic = await new ProjectCostModificationRepository( this.channelId ).count({
					where: {
						project_id			: id,
						status				: CONSTANTS.COST_MODIFICATION_STATUS.WAITING,
						project_cost_item_id: { [ Op.ne ]: null },
					},
				});
			}

			// Quotation
			if ( isPM || isSale || isProcurementManager ) {
				result.quotation = await new ProjectApproverRepository( this.channelId ).count({
					where: {
						project_id	: id,
						user_id		: this.currentUser.id,
						status		: CONSTANTS.QUOTATION_STATUS.WAITING_APPROVAL,
					},
				});
			}

			// Purchasing
			if ( isCEO || isPM || isProcurementManager ) {
				result.purchasing = await new PurchaseOrderApproverRepository( this.channelId ).count({
					where: {
						user_id		: isPM ? this.currentUser.id : null,
						status		: CONSTANTS.PURCHASE_ORDER_APPROVE_STATUS.WAITING_APPROVAL,
					},
					include: {
						model		: await ProjectPurchaseOrder( this.channelId ),
						attributes	: [],
						required	: true,
						include: {
							model		: await Project( this.channelId ),
							attributes	: [],
							where: { id },
						},
					},
				});
			}

			// VO
			if ( isCEO || isPM || isProcurementManager || isSale ) {
				result.vo = await new VOApproverRepository( this.channelId ).count({
					where: {
						user_id		: ( isPM || isSale ) ? this.currentUser.id : null,
						status		: CONSTANTS.VO_APPROVE_STATUS.WAITING_APPROVAL,
					},
					include: {
						model		: await ProjectVO( this.channelId ),
						attributes	: [],
						required	: true,
						include: {
							model		: await Project( this.channelId ),
							attributes	: [],
							where: { id },
						},
					},
				});
			}

			// Receivables
			if ( isCFO || isLiabilitiesAccountant ) {
				const receivableStatus = [ CONSTANTS.BILL_STATUS.PROCESSING, CONSTANTS.BILL_STATUS.INVOICE_SENT ];
				const receivablesOptions = {
					where: {
						project_id	: id,
						status		: { [ Op.in ]: receivableStatus },
					},
				};

				if ( isCFO ) receivableStatus.push( CONSTANTS.BILL_STATUS.WAITING );

				result.receivables = await new ProjectBillRepository( this.channelId ).count( receivablesOptions );
			}

			// Receivables plan waiting approve
			if ( isCEO || isCFO ) {
				const receivablePlanOptions = {
					where: {
						id,
						bill_plan_approve_by: null,
						bill_plan_status	: CONSTANTS.QUOTATION_STATUS.WAITING_APPROVAL,
					},
				};

				result.receivable_plan = await new ProjectRepository( this.channelId ).count( receivablePlanOptions );
			}

			// Payables waiting approve
			if ( isProcurementManager || isGeneralAccountant || isCFO ) {
				const paymentApproverOptions = {
					where: {
						user_id		: null,
						status		: CONSTANTS.PAYMENT_APPROVE_STATUS.WAITING_APPROVAL,
					},
					include: {
						model		: await ProjectPayment( this.channelId ),
						attributes	: [],
						where		: { project_id: id },
					},
				};

				if ( isProcurementManager ) paymentApproverOptions.where.role_key = 'PROCUREMENT_MANAGER';
				if ( isGeneralAccountant ) paymentApproverOptions.where.role_key = 'GENERAL_ACCOUNTANT';
				if ( isCFO ) paymentApproverOptions.where.role_key = 'CFO';

				result.payables_waiting_approve = await new ProjectPaymentApproverRepository( this.channelId )
				.count( paymentApproverOptions );
			}

			// Payables
			if ( isCFO || isLiabilitiesAccountant ) {
				const paymentStatus = [ CONSTANTS.PAYMENT_STATUS.CONFIRMED ];
				const paymentOptions = {
					where: {
						project_id	: id,
						status		: { [ Op.in ]: paymentStatus },
					},
				};

				if ( isCFO ) paymentStatus.push( CONSTANTS.PAYMENT_STATUS.WAITING );

				result.payables = await new ProjectPaymentRepository( this.channelId ).count( paymentOptions );
			}

			// Payable plan waiting approve
			if ( isCEO || isCFO ) {
				const payablePlanOptions = {
					where: {
						id,
						payment_plan_approve_by	: null,
						payment_plan_status		: CONSTANTS.QUOTATION_STATUS.WAITING_APPROVAL,
					},
				};

				result.payable_plan = await new ProjectRepository( this.channelId ).count( payablePlanOptions );
			}

			deferred.resolve( result );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

}

module.exports = ProjectWaitingActionHandler;
