const Q = require( 'q' );
const _ = require( 'underscore' );
const Sequelize = require( 'sequelize' );

const Project = require( '@models/finance/project/project' );
const ProjectSheet = require( '@models/finance/project/project_sheet' );
const ProjectLineItemRepository = require( '@models/finance/project/project_line_item_repository' );

const { Logger, Account } = require( '@helpers' );

const Op = Sequelize.Op;

class ProjectLineUtility {

	/**
	* @constructor
	* @param {string} channelId
	* @param {object} userData
	*/
	constructor( channelId, userData = null ) {
		this.channelId = channelId;
		this.userData = userData;
		this.account = new Account( userData );
	}

	/**
	* Handle sum project cost
	* @param {any} projectId
	* @param {any} transaction - Transaction to commit/rollback
	* @return {promise}
	*/
	async handleSumProjectLine( projectId = null, transaction = null ) {
		const deferred = Q.defer();

		try {
			const options = {
				attributes: [
					'id',
					[ Sequelize.fn( 'sum', Sequelize.literal( 'amount * price' ) ), 'total' ],
				],
				include: {
					model		: await ProjectSheet( this.channelId ),
					attributes	: [],
					require		: true,
					include: {
						model		: await Project( this.channelId ),
						attributes	: [],
						require		: true,
					},
				},
				transaction,
			};

			if ( projectId ) {
				options.include.where = {
					project_id: _.isArray( projectId ) ? { [ Op.in ]: projectId } : projectId,
				};
			}

			if ( this.account.isPM() ) {
				!options.include.include.where && ( options.include.include.where = {} );
				options.include.include.where.manage_by = this.currentUser.id;
			}
			if ( this.account.isQS() ) {
				!options.include.include.where && ( options.include.include.where = {} );
				options.include.include.where.qs_by = this.currentUser.id;
			}

			const result = await new ProjectLineItemRepository( this.channelId ).getOne( options );

			deferred.resolve( result.dataValues.total || 0 );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle sum each project cost
	* @param {any} projectId
	* @param {any} transaction - Transaction to commit/rollback
	* @return {promise}
	*/
	async handleSumEachProjectLine( projectId = null, transaction = null ) {
		const deferred = Q.defer();

		try {
			const options = {
				attributes: [
					'id',
					[ Sequelize.col( 'project_sheet.project_id' ), 'project_id' ],
					[ Sequelize.fn( 'sum', Sequelize.literal( 'amount * price' ) ), 'total' ],
				],
				include: {
					model		: await ProjectSheet( this.channelId ),
					attributes	: [],
					require		: true,
					include: {
						model		: await Project( this.channelId ),
						attributes	: [],
						require		: true,
					},
				},
				group: [ 'project_id' ],
				transaction,
			};

			if ( projectId ) {
				options.include.where = {
					project_id: _.isArray( projectId ) ? { [ Op.in ]: projectId } : projectId,
				};
			}

			if ( this.account.isPM() ) {
				!options.include.include.where && ( options.include.include.where = {} );
				options.include.include.where.manage_by = this.currentUser.id;
			}
			if ( this.account.isQS() ) {
				!options.include.include.where && ( options.include.include.where = {} );
				options.include.include.where.qs_by = this.currentUser.id;
			}

			const result = await new ProjectLineItemRepository( this.channelId ).getAll( options );

			deferred.resolve( result );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

}

module.exports = ProjectLineUtility;
