const Client = require( './api/finance/client/client' );
const Vendor = require( './api/finance/vendor/vendor' );
const VendorCategory = require( './api/finance/vendor/vendor_category' );
const LineItemCategory = require( './api/finance/line_item_category/line_item_category' );
const CostItemCategory = require( './api/finance/cost_item_category/cost_item_category' );
const Project = require( './api/finance/project/project' );
const ProjectVO = require( './api/finance/project/project_vo' );
const ProjectSheet = require( './api/finance/project/project_sheet' );
const ProjectBill = require( './api/finance/project/project_bill' );
const ProjectBillPlan = require( './api/finance/project/project_bill_plan' );
const ProjectPayment = require( './api/finance/project/project_payment' );
const ProjectPaymentPlan = require( './api/finance/project/project_payment_plan' );
const ProjectLineItem = require( './api/finance/project/project_line_item' );
const ProjectCostItem = require( './api/finance/project/project_cost_item' );
const ProjectPurchaseOrder = require( './api/finance/project/project_purchase_order' );
const PurchaseOrderApprover = require( './api/finance/project/purchase_order_approver' );
const ProjectCostModification = require( './api/finance/project/project_cost_modification' );
const ProjectWaitingAction = require( './api/finance/project/project_waiting_action' );
const Receivables = require( './api/finance/receivables/receivables' );
const Payables = require( './api/finance/payables/payables' );
const User = require( './api/finance/user/user' );
const UserRole = require( './api/finance/user/user_role' );
const Setting = require( './api/finance/setting/setting' );
const Account = require( './api/user/account' );
const LezoEmployee = require( './api/ext/lezo/lezo_employee' );
const LezoProject = require( './api/ext/lezo/lezo_project' );
const LezoClient = require( './api/ext/lezo/lezo_client' );
const Channel = require( './auth/channel' );
const Session = require( './auth/session' );
const Activate = require( './auth/activate' );

module.exports = {
	api: {
		user: { account: Account },
		finance: {
			client						: Client,
			vendor						: Vendor,
			vendor_category				: VendorCategory,
			line_item_category			: LineItemCategory,
			cost_item_category			: CostItemCategory,
			project						: Project,
			project_vo					: ProjectVO,
			project_sheet				: ProjectSheet,
			project_bill				: ProjectBill,
			project_bill_plan			: ProjectBillPlan,
			project_payment				: ProjectPayment,
			project_payment_plan		: ProjectPaymentPlan,
			project_line_item			: ProjectLineItem,
			project_cost_item			: ProjectCostItem,
			project_purchase_order		: ProjectPurchaseOrder,
			purchase_order_approver		: PurchaseOrderApprover,
			project_cost_modification	: ProjectCostModification,
			project_waiting_action		: ProjectWaitingAction,
			receivables					: Receivables,
			payables					: Payables,
			user						: User,
			user_role					: UserRole,
			setting						: Setting,
		},
		ext: {
			lezo: {
				lezo_employee	: LezoEmployee,
				lezo_project	: LezoProject,
				lezo_client		: LezoClient,
			},
		},
	},
	auth: {
		channel	: Channel,
		session	: Session,
		activate: Activate,
	},
};
