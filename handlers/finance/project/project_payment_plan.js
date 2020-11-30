const Q = require( 'q' );
const _ = require( 'underscore' );
const Sequelize = require( 'sequelize' );

const ProjectPaymentPlanRepository = require( '@models/finance/project/project_payment_plan_repository' );
const Project = require( '@models/finance/project/project' );

const { Logger, Account, Model } = require( '@helpers' );
const { STATUS_CODE, STATUS_MESSAGE, CONSTANTS } = require( '@resources' );

const Op = Sequelize.Op;

class ProjectPaymentPlanHandler {

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
	* Handle get project Payment plan
	* @param {object} queryOptions
	* @return {promise}
	*/
	handleGetAll( queryOptions = {} ) {
		const deferred = Q.defer();

		try {
			const projectPaymentPlanRepository = new ProjectPaymentPlanRepository( this.channelId );

			if ( queryOptions && queryOptions.project_id ) {
				return projectPaymentPlanRepository.getAll( { where: { project_id: queryOptions.project_id } } );
			}

			if ( !this.account.isCEO() && !this.account.isCFO() ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}

			return projectPaymentPlanRepository.getAll();
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle create project Payment plan
	* @param {object} data - Project Payment data
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
			const projectPaymentPlanRepository = new ProjectPaymentPlanRepository( this.channelId );
			const transaction = await new Model( this.channelId ).transaction();
			const projectPaymentPlans = await projectPaymentPlanRepository.getAll( {
				where: { project_id: data.project_id },
				transaction,
			} );

			if ( !projectPaymentPlans ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'CREAT_PROJECT_PAYMENT_PLAN_FAIL',
				});
				return deferred.promise;
			}

			let totalTargetPercent = 0;
			if ( projectPaymentPlans.length ) {
				_.each( projectPaymentPlans, item => {
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

			const result = await projectPaymentPlanRepository.create( createData, { transaction } );

			if ( !result || !result.status ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'CREAT_PROJECT_PAYMENT_PLAN_FAIL',
				});
				return deferred.promise;
			}

			// Commit transaction
			transaction.commit();

			deferred.resolve({
				status	: true,
				message	: 'CREAT_PROJECT_PAYMENT_PLAN_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update project Payment plan
	* @param {int} id - Project Payment id
	* @param {object} data - Project Payment data
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
			const projectPaymentPlanRepository = new ProjectPaymentPlanRepository( this.channelId );
			const projectPaymentPlan = await projectPaymentPlanRepository.getOne( updateOptions );

			if ( !projectPaymentPlan || !projectPaymentPlan.id ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'PROJECT_PAYMENT_PLAN_NOT_FOUND',
				});
				return deferred.promise;
			}

			const projectPaymentPlans = await projectPaymentPlanRepository.getAll( {
				where: { project_id: projectPaymentPlan.project_id },
				transaction,
			} );

			if ( !projectPaymentPlans ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'UPDATE_PROJECT_PAYMENT_PLAN_FAIL',
				});
				return deferred.promise;
			}

			let totalTargetPercent = 0;
			if ( projectPaymentPlans.length ) {
				_.each( projectPaymentPlans, item => {
					totalTargetPercent += item.target_percent;
				} );
			}
			totalTargetPercent += data.target_percent - projectPaymentPlan.target_percent;

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
				project_id		: projectPaymentPlan.project_id,
				name			: data.name,
				note			: data.note,
				target_date		: data.target_date,
				target_percent	: data.target_percent,
			};

			const result = await projectPaymentPlanRepository.update( updateData, updateOptions );

			if ( !result || !result.status ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'UPDATE_PROJECT_PAYMENT_PLAN_FAIL',
				});
				return deferred.promise;
			}

			// Commit transaction
			transaction.commit();

			deferred.resolve({
				status	: true,
				message	: 'UPDATE_PROJECT_PAYMENT_PLAN_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle delete project Payment plan
	* @param {int} id - Project Payment id
	* @return {promise}
	*/
	async handleDelete( id ) {
		const deferred = Q.defer();

		try {
			const projectPaymentPlanRepository = new ProjectPaymentPlanRepository( this.channelId );
			const projectPaymentPlan = await projectPaymentPlanRepository.getOne( {
				where: { id },
				include: {
					model: await Project( this.channelId ),
					where: {
						quotation_status	: CONSTANTS.QUOTATION_STATUS.APPROVED,
						payment_plan_status	: { [ Op.notIn ]: [ CONSTANTS.PLAN_STATUS.APPROVED, CONSTANTS.PLAN_STATUS.WAITING_APPROVAL ] },
					},
				},
			} );

			if ( !projectPaymentPlan || !projectPaymentPlan.id ) {
				deferred.resolve({
					status	: false,
					message	: 'PROJECT_PAYMENT_PLAN_NOT_FOUND',
				});
				return deferred.promise;
			}
			return new ProjectPaymentPlanRepository( this.channelId ).delete( { where: { id } } );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

}

module.exports = ProjectPaymentPlanHandler;
