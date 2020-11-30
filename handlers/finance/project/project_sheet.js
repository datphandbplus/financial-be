const Q = require( 'q' );
const Sequelize = require( 'sequelize' );
const _ = require( 'underscore' );

const Project = require( '@models/finance/project/project' );
const ProjectRepository = require( '@models/finance/project/project_repository' );
const ProjectSheetRepository = require( '@models/finance/project/project_sheet_repository' );
const ProjectLineItem = require( '@models/finance/project/project_line_item' );
const ProjectLineUtility = require( '@models/finance/project/project_line_utility' );

const { Logger, Account } = require( '@helpers' );
const { STATUS_CODE, STATUS_MESSAGE, CONSTANTS } = require( '@resources' );

const Op = Sequelize.Op;

class ProjectSheetHandler {

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
	* Handle get project sheets
	* @param {object} queryOptions
	* @return {promise}
	*/
	async handleGetAll( queryOptions = {} ) {
		const deferred = Q.defer();

		try {
			const options = {
				attributes: [ 'id', 'project_id', 'name' ],
				where: {},
			};

			if ( queryOptions.query_for === 'reference_by_project' && queryOptions.project_id ) {
				options.where.project_id = queryOptions.project_id;
				options.include = {
					model		: await ProjectLineItem( this.channelId ),
					attributes	: [ 'id', 'discount_amount', 'discount_status' ],
				};
			}

			if ( queryOptions.query_for === 'reference' && queryOptions.project_id ) {
				options.where.project_id = queryOptions.project_id;
				return new ProjectSheetRepository( this.channelId ).getAll( options );
			}

			// Prevent get all sheets if user is not CEO
			if ( !this.account.isCEO() && ( !_.keys( options.where ).length ) ) {
				deferred.reject({
					status	: STATUS_CODE.BAD_REQUEST,
					message	: STATUS_MESSAGE.BAD_REQUEST,
				});
				return deferred.promise;
			}

			return new ProjectSheetRepository( this.channelId ).getAll( options );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle create project sheet
	* @param {object} data - Project sheet data
	* @return {promise}
	*/
	async handleCreate( data ) {
		const deferred = Q.defer();

		try {
			const options = {
				attributes: [ 'id' ],
				where: {
					id: data.project_id,
					quotation_status: {
						[ Op.in ]: [ CONSTANTS.QUOTATION_STATUS.PROCESSING, CONSTANTS.QUOTATION_STATUS.CANCELLED ],
					},
				},
			};
			const createData = {
				name		: data.name,
				project_id	: data.project_id,
				description	: data.description,
				note		: data.note,
			};
			const projectSheetRepository = new ProjectSheetRepository( this.channelId );
			const project = await new ProjectRepository( this.channelId ).getOne( options );
			const projectSheet = await projectSheetRepository.getOne({
				where: {
					project_id : data.project_id,
					name       : data.name,
				},
			});

			if ( !project || !project.id ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}

			if ( projectSheet ) {
				deferred.resolve({
					status	: false,
					message	: 'PROJECT_SHEET_EXIST',
				});
				return deferred.promise;
			}

			return projectSheetRepository.create( createData );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update project sheet
	* @param {int} id - Project sheet id
	* @param {object} data - Project sheet data
	* @return {promise}
	*/
	async handleUpdate( id, data ) {
		const deferred = Q.defer();

		try {
			await this._getProjectSheet( id );

			const updateData = {
				name		: data.name,
				project_id	: data.project_id,
				description	: data.description,
				note		: data.note,
			};
			const updateOptions = { where: { id } };
			const projectSheetRepository = new ProjectSheetRepository( this.channelId );
			const projectSheet = await projectSheetRepository.getOne({
				where: {
					project_id : data.project_id,
					name       : data.name,
				},
			});

			if ( projectSheet ) {
				deferred.resolve({
					status	: false,
					message	: 'PROJECT_SHEET_EXIST',
				});
				return deferred.promise;
			}

			return projectSheetRepository.update( updateData, updateOptions );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle delete project sheet
	* @param {int} id - Project sheet id
	* @return {promise}
	*/
	async handleDelete( id ) {
		const deferred = Q.defer();

		try {
			// Check project sheet
			const sheet = await this._getProjectSheet( id );

			// Check quotation discount
			const projectData = sheet.data || {};

			if ( projectData.discount_type === '$' ) {
				const totalLine = await new ProjectLineUtility( this.channelId )
				.handleSumProjectLine( projectData.project_id );

				if ( totalLine - projectData.total_line - projectData.discount_amount < 0 ) {
					deferred.resolve({
						status	: false,
						message	: 'DATA_INVALID',
					});
					return deferred.promise;
				}
			}

			return new ProjectSheetRepository( this.channelId ).delete( { where: { id } } );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}
	}

	/**
	* Get project sheet
	* @param {int} id - Project sheet id
	* @return {promise}
	*/
	async _getProjectSheet( id ) {
		const deferred = Q.defer();

		try {
			const options = {
				attributes: [
					'id', 'project_id',
					[
						Sequelize.fn(
							'sum',
							Sequelize.literal( 'project_line_items.amount * project_line_items.price' )
						),
						'total_line',
					],
					[ Sequelize.col( 'project.id' ), 'project_id' ],
					[ Sequelize.col( 'project.discount_amount' ), 'discount_amount' ],
					[ Sequelize.col( 'project.discount_type' ), 'discount_type' ],
				],
				where: { id },
				include: [
					{
						model		: await Project( this.channelId ),
						attributes	: [],
						where: {
							quotation_status: {
								[ Op.in ]: [ CONSTANTS.QUOTATION_STATUS.PROCESSING, CONSTANTS.QUOTATION_STATUS.CANCELLED ],
							},
						},
					},
					{
						model		: await ProjectLineItem( this.channelId ),
						attributes	: [],
					},
				],
			};

			if ( this.account.isPM() ) {
				options.where[ Op.or ] = [
					Sequelize.where(
						Sequelize.col( 'project.manage_by' ),
						this.currentUser.id
					),
				];
			}

			const projectSheet = await new ProjectSheetRepository( this.channelId ).getOne( options );

			if ( !projectSheet || !projectSheet.id ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}

			deferred.resolve({
				status	: true,
				message	: 'PROJECT_SHEET_VALID',
				data	: projectSheet.dataValues,
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

}

module.exports = ProjectSheetHandler;
