const Q = require( 'q' );
const Sequelize = require( 'sequelize' );

const ProjectVORepository = require( '@models/finance/project/project_vo_repository' );

const { Logger, Account } = require( '@helpers' );
const { CONSTANTS } = require( '@resources' );

class VOUtility {

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
	* Handle sum quotation
	* @param {int} projectId - Project id
	* @return {promise}
	*/
	async handleSumQuotation( projectId ) {
		const deferred = Q.defer();

		try {
			const vo = await new ProjectVORepository( this.channelId ).getOne({
				attributes: [
					'id', 'project_id',
					[ Sequelize.fn( 'sum', Sequelize.col( 'diff_quotation_total' ) ), 'total' ],
					[ Sequelize.fn( 'sum', Sequelize.col( 'diff_quotation_vat' ) ), 'vat' ],
				],
				where: {
					project_id	: projectId,
					status		: CONSTANTS.PROJECT_VO_STATUS.APPROVED,
				},
				group: [ 'project_id' ],
			});

			if ( !vo || !vo.id ) {
				deferred.resolve({
					total	: 0,
					vat		: 0,
				});
				return deferred.promise;
			}

			deferred.resolve({
				total	: vo.dataValues.total,
				vat		: vo.dataValues.vat,
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

}

module.exports = VOUtility;
