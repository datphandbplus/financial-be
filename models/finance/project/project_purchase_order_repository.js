const ProjectPurchaseOrder = require( './project_purchase_order' );
const Repository = require( '@models/repository' );

class ProjectPurchaseOrderRepository extends Repository {

	/**
	* @constructor
	* @param {string} channelId
	*/
	constructor( channelId ) {
		super( ProjectPurchaseOrder( channelId ) );
	}

}

module.exports = ProjectPurchaseOrderRepository;
