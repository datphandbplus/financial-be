const ProjectPaymentApprover = require( './project_payment_approver' );
const Repository = require( '@models/repository' );

class ProjectPaymentApproverRepository extends Repository {

	/**
	* @constructor
	* @param {string} channelId
	*/
	constructor( channelId ) {
		super( ProjectPaymentApprover( channelId ) );
	}

}

module.exports = ProjectPaymentApproverRepository;
