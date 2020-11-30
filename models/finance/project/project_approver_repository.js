const ProjectApprover = require( './project_approver' );
const Repository = require( '@models/repository' );

class ProjectApproverRepository extends Repository {

	/**
	* @constructor
	* @param {string} channelId
	*/
	constructor( channelId ) {
		super( ProjectApprover( channelId ) );
	}

}

module.exports = ProjectApproverRepository;
