const Helpers = require( 'nodejs-core/multi_db/helpers' );

const User = require( '@models/finance/user/user' );
const UserRole = require( '@models/finance/user/user_role' );
const Client = require( '@models/finance/client/client' );
const Vendor = require( '@models/finance/vendor/vendor' );
const VendorCategory = require( '@models/finance/vendor/vendor_category' );
const LineItemCategory = require( '@models/finance/line_item_category/line_item_category' );
const CostItemCategory = require( '@models/finance/cost_item_category/cost_item_category' );
const Project = require( '@models/finance/project/project' );
const ProjectSheet = require( '@models/finance/project/project_sheet' );
const ProjectBill = require( '@models/finance/project/project_bill' );
const ProjectBillPlan = require( '@models/finance/project/project_bill_plan' );
const ProjectLineItem = require( '@models/finance/project/project_line_item' );
const ProjectCostItem = require( '@models/finance/project/project_cost_item' );
const ProjectPurchaseOrder = require( '@models/finance/project/project_purchase_order' );
const ProjectPayment = require( '@models/finance/project/project_payment' );
const ProjectPaymentPlan = require( '@models/finance/project/project_payment_plan' );
const ProjectCostModification = require( '@models/finance/project/project_cost_modification' );
const ProjectApprover = require( '@models/finance/project/project_approver' );
const ProjectVO = require( '@models/finance/project/project_vo' );
const VOApprover = require( '@models/finance/project/vo_approver' );
const ProjectPaymentApprover = require( '@models/finance/project/project_payment_approver' );
const PurchaseOrderApprover = require( '@models/finance/project/purchase_order_approver' );
const Setting = require( '@models/finance/setting/setting' );

const Factory = require( '@helpers/factory' );

const SERVER = Factory.getConfig( 'server' );

class Model extends Helpers.Model {

	/**
	* General default channel models
	* @static
	* @return {void}
	*/
	static generateDefaultChannelModels() {
		if ( !SERVER.DEFAULT_CHANNEL ) return;

		new Model( SERVER.DEFAULT_CHANNEL ).generate();
	}

	/**
	* General models
	* @override
	* @return {promise}
	*/
	generate() {
		return super.generate([
			// User
			super.createPromiseFunc( UserRole ),
			super.createPromiseFunc( User ),

			// Client
			super.createPromiseFunc( Client ),

			// Vendor
			super.createPromiseFunc( VendorCategory ),
			super.createPromiseFunc( Vendor ),

			// Line item
			super.createPromiseFunc( LineItemCategory ),

			// Cost item
			super.createPromiseFunc( CostItemCategory ),

			// Project
			super.createPromiseFunc( Project ),
			super.createPromiseFunc( ProjectVO ),
			super.createPromiseFunc( ProjectSheet ),
			super.createPromiseFunc( ProjectBill ),
			super.createPromiseFunc( ProjectBillPlan ),
			super.createPromiseFunc( ProjectLineItem ),
			super.createPromiseFunc( ProjectCostItem ),
			super.createPromiseFunc( ProjectPurchaseOrder ),
			super.createPromiseFunc( ProjectPayment ),
			super.createPromiseFunc( ProjectPaymentPlan ),
			super.createPromiseFunc( ProjectCostModification ),
			super.createPromiseFunc( ProjectApprover ),
			super.createPromiseFunc( ProjectPaymentApprover ),
			super.createPromiseFunc( PurchaseOrderApprover ),
			super.createPromiseFunc( VOApprover ),

			// Setting
			super.createPromiseFunc( Setting ),
		]);
	}

}

module.exports = Model;
