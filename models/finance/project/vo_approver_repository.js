const Repository = require( '@models/repository' );
const VOApprover = require( './vo_approver' );

class VOApproverRepository extends Repository {

	/**
	* @constructor
	* @param {string} channelId
	*/
	constructor( channelId ) {
		super( VOApprover( channelId ) );
	}

}

module.exports = VOApproverRepository;
