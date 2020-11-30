const Repository = require( '@models/repository' );
const PurchaseOrderApprover = require( './purchase_order_approver' );

class PurchaseOrderApproverRepository extends Repository {

	/**
	* @constructor
	* @param {string} channelId
	*/
	constructor( channelId ) {
		super( PurchaseOrderApprover( channelId ) );
	}

}

module.exports = PurchaseOrderApproverRepository;
