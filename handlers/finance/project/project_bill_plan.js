const Q = require( 'q' );
const _ = require( 'underscore' );
const Sequelize = require( 'sequelize' );

const ProjectBillPlanRepository = require( '@models/finance/project/project_bill_plan_repository' );
const Project = require( '@models/finance/project/project' );

const { Logger, Account, Model } = require( '@helpers' );
const { STATUS_CODE, STATUS_MESSAGE, CONSTANTS } = require( '@resources' );

const Op = Sequelize.Op;

class ProjectBillPlanHandler {

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
	* Handle get project bill plan
	* @param {object} queryOptions
	* @return {promise}
	*/
	handleGetAll( queryOptions = {} ) {
		const deferred = Q.defer();

		try {
			const projectBillPlanRepository = new ProjectBillPlanRepository( this.channelId );
			if ( queryOptions && queryOptions.project_id ) {
				return projectBillPlanRepository.getAll( { where: { project_id: queryOptions.project_id } } );
			}

			if ( !this.account.isCEO() && !this.account.isCFO() ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}

			return projectBillPlanRepository.getAll();
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle create project Bill plan
	* @param {object} data - Project Bill data
	* @return {promise}
	*/
	async handleCreate( data ) {
		const deferred = Q.defer();

		try {
			const createData = {
				project_id		: data.project_id,
				name			: data.name,
				note			: data.note,
				target_date		: data.target_date,
				target_percent	: data.target_percent,
			};
			const projectBillPlanRepository = new ProjectBillPlanRepository( this.channelId );
			const transaction = await new Model( this.channelId ).transaction();
			const projectBillPlans = await projectBillPlanRepository.getAll( {
				where: { project_id: data.project_id },
				transaction,
			} );

			if ( !projectBillPlans ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'CREAT_PROJECT_BILL_PLAN_FAIL',
				});
				return deferred.promise;
			}

			let totalTargetPercent = 0;
			if ( projectBillPlans.length ) {
				_.each( projectBillPlans, item => {
					totalTargetPercent += item.target_percent;
				} );
			}
			totalTargetPercent += data.target_percent;

			if ( totalTargetPercent > 100 ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'PROJECT_PLAN_OVER',
				});
				return deferred.promise;
			}

			const result = await projectBillPlanRepository.create( createData, { transaction } );

			if ( !result || !result.status ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'CREAT_PROJECT_BILL_PLAN_FAIL',
				});
				return deferred.promise;
			}

			// Commit transaction
			transaction.commit();

			deferred.resolve({
				status	: true,
				message	: 'CREAT_PROJECT_BILL_PLAN_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update project Bill plan
	* @param {int} id - Project Bill id
	* @param {object} data - Project Bill data
	* @return {promise}
	*/
	async handleUpdate( id, data ) {
		const deferred = Q.defer();

		try {
			const transaction = await new Model( this.channelId ).transaction();
			const updateOptions = {
				where: { id },
				transaction,
			};
			const projectBillPlanRepository = new ProjectBillPlanRepository( this.channelId );
			const projectBillPlan = await projectBillPlanRepository.getOne( updateOptions );

			if ( !projectBillPlan || !projectBillPlan.id ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'PROJECT_BILL_PLAN_NOT_FOUND',
				});
				return deferred.promise;
			}

			const projectBillPlans = await projectBillPlanRepository.getAll( {
				where: { project_id: projectBillPlan.project_id },
				transaction,
			} );

			if ( !projectBillPlans ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'UPDATE_PROJECT_BILL_PLAN_FAIL',
				});
				return deferred.promise;
			}

			let totalTargetPercent = 0;
			if ( projectBillPlans.length ) {
				_.each( projectBillPlans, item => {
					totalTargetPercent += item.target_percent;
				} );
			}
			totalTargetPercent += data.target_percent - projectBillPlan.target_percent;

			if ( totalTargetPercent > 100 ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'PROJECT_PLAN_OVER',
				});
				return deferred.promise;
			}
			const updateData = {
				project_id		: projectBillPlan.project_id,
				name			: data.name,
				note			: data.note,
				target_date		: data.target_date,
				target_percent	: data.target_percent,
			};

			const result = await projectBillPlanRepository.update( updateData, updateOptions );

			if ( !result || !result.status ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'UPDATE_PROJECT_BILL_PLAN_FAIL',
				});
				return deferred.promise;
			}

			// Commit transaction
			transaction.commit();

			deferred.resolve({
				status	: true,
				message	: 'UPDATE_PROJECT_BILL_PLAN_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle delete project bill plan
	* @param {int} id - Project bill id
	* @return {promise}
	*/
	async handleDelete( id ) {
		const deferred = Q.defer();

		try {
			const projectBillPlanRepository = new ProjectBillPlanRepository( this.channelId );
			const projectBillPlan = await projectBillPlanRepository.getOne( {
				where: { id },
				include: {
					model: await Project( this.channelId ),
					where: {
						quotation_status	: CONSTANTS.QUOTATION_STATUS.APPROVED,
						bill_plan_status	: { [ Op.notIn ]: [ CONSTANTS.PLAN_STATUS.APPROVED, CONSTANTS.PLAN_STATUS.WAITING_APPROVAL ] },
					},
				},
			} );

			if ( !projectBillPlan || !projectBillPlan.id ) {
				deferred.resolve({
					status	: false,
					message	: 'PROJECT_BILL_PLAN_NOT_FOUND',
				});
				return deferred.promise;
			}
			return new ProjectBillPlanRepository( this.channelId ).delete( { where: { id } } );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

}

module.exports = ProjectBillPlanHandler;
