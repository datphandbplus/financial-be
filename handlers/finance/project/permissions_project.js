// const Q = require( 'q' );
// const _ = require( 'underscore' );
// const Sequelize = require( 'sequelize' );

// const ProjectVORepository = require( '@models/finance/project/project_vo_repository' );
// const ProjectLineItem = require( '@models/finance/project/project_line_item' );
// const ProjectLineCost = require( '@models/finance/project/project_cost_item' );
// const ProjectLineItemRepository = require( '@models/finance/project/project_line_item_repository' );
// const ProjectCostItemRepository = require( '@models/finance/project/project_cost_item_repository' );
// const VOApproverRepository = require( '@models/finance/project/vo_approver_repository' );
// const Project = require( '@models/finance/project/project' );
// const ProjectRepository = require( '@models/finance/project/project_repository' );
// const ProjectSheetRepository = require( '@models/finance/project/project_sheet_repository' );

// const ProjectRepository = require( '@models/finance/project/project_repository' );
// const VOApprover = require( '@models/finance/project/vo_approver' );
// const User = require( '@models/finance/user/user' );
// const ProjectLineUtility = require( '@models/finance/project/project_line_utility' );
// const ProjectBillRepository = require( '@models/finance/project/project_bill_repository' );
// const VOUtility = require( '@models/finance/project/vo_utility' );

const { Account } = require( '@helpers' );
// const { CONSTANTS } = require( '@resources' );
// const Op = Sequelize.Op;

class ProjectPermissions {

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
     * Handle check valid vo
     * @param {object} params - Project vo id
     * @param {number} statusProjectId
     * @return {promise}
     */
	// async _checkProjectPermissionByRequest(params, statusProjectId) {
	// 	const deferred = Q.defer();
	// 	let statusId = null;
	// 	try {
	// 		if ( !params ) return;
	// 		// Project_id
	// 		if (params.project_id) {
	// 			const id = params.project_id;
	// 			const projectInfo = await new ProjectRepository( this.channelId ).getOne({
	// 				attributes	: [ 'id', 'project_status' ],
	// 				where		: { id },
	// 			});
	// 			statusId = projectInfo.project_status || null;
	// 		}
	// 		//
	// 		if (params.vo_add_id) {
	// 			const projectVoInfo = await new ProjectVORepository( this.channelId ).getOne({
	// 				attributes	: [],
	// 				where		: { id: params.vo_add_id },
	// 				include: {
	// 					model		: await new Project( this.channelId ),
	// 					attributes	: [ 'project_status' ],
	// 				},
	// 			});
	// 			statusId = projectVoInfo.project.project_status || null;
	// 		}
	// 		if (params.project_sheet_id) {
	// 			const projectSheetInfo = await new ProjectSheetRepository( this.channelId ).getOne({
	// 				attributes	: [
	// 					'id',
	// 					[ Sequelize.col( 'project.project_status' ), 'project_status' ],
	// 				],
	// 				where		: { id: params.project_sheet_id },
	// 				include: [
	// 					{
	// 						model		: await Project( this.channelId ),
	// 						attributes	: [],
	// 					},
	// 				],
	// 			});
	// 			statusId = projectSheetInfo.dataValues.project_status;
	// 		}
	// 		if (statusId === statusProjectId) {
	// 			deferred.resolve({
	// 				status	: false,
	// 				message	: 'GET_VO_FAIL',
	// 			});
	// 			return deferred.promise;
	// 		}
	//
	//
	// 		const projectVO = await new ProjectVORepository( this.channelId ).getOne({
	// 			include: {
	// 				model: await Project( this.channelId ),
	// 				where: {
	// 					quotation_status: CONSTANTS.QUOTATION_STATUS.APPROVED,
	// 					qs_by: this.currentUser.id,
	// 				},
	// 			},
	// 			where: {
	// 				id,
	// 				status: {
	// 					[ Op.notIn ]: [ CONSTANTS.PROJECT_VO_STATUS.APPROVED, CONSTANTS.PROJECT_VO_STATUS.WAITING_APPROVAL ],
	// 				},
	// 			},
	// 		});
	//
	// 		if ( !projectVO || !projectVO.id ) {
	// 			deferred.resolve({
	// 				status	: false,
	// 				message	: 'GET_VO_FAIL',
	// 			});
	// 			return deferred.promise;
	// 		}
	//
	// 		deferred.resolve({
	// 			status	: true,
	// 			message	: 'CHECK_PROJECT_STATUS_SUCCESS',
	// 		});
	// 	} catch ( error ) {
	// 		deferred.reject( error );
	// 		new Logger().write( 'error', error, this.channelId );
	// 	}
	//
	// 	return deferred.promise;
	// }

}

module.exports = ProjectPermissions;
