const Q = require( 'q' );
const _ = require( 'underscore' );
const Sequelize = require( 'sequelize' );

const SettingRepository = require( '@models/finance/setting/setting_repository' );

const { Logger, Account } = require( '@helpers' );

const Op = Sequelize.Op;

class SettingHandler {

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
	* Handle get settings
	* @param {object} queryOptions
	* @return {promise}
	*/
	handleGetAll( queryOptions = {} ) {
		const options = {
			attributes: [ 'key', 'value' ],
		};

		if ( queryOptions && queryOptions.keys ) {
			const keys = queryOptions.keys.split( ',' );

			options.where = {
				key: { [ Op.in ]: _.uniq( keys ) },
			};
		}

		return new SettingRepository( this.channelId ).getAll( options );
	}

	/**
	* Handle bulk update settings
	* @param {object} data - Setting data
	* @return {promise}
	*/
	async handleBulkUpdate( data ) {
		const deferred = Q.defer();

		try {
			const bulkCreateData = _.map( data, item => {
				return { key: item.key, value: item.value };
			});
			const bulkCreateOptions = { updateOnDuplicate: [ 'value' ] };
			const bulkCreateResult = await new SettingRepository( this.channelId )
			.bulkCreate( bulkCreateData, bulkCreateOptions );

			if ( !bulkCreateResult || !bulkCreateResult.status ) {
				deferred.resolve({
					status	: false,
					message	: 'UPDATE_SETTING_FAIL',
				});
				return deferred.promise;
			}

			deferred.resolve({
				status	: true,
				message	: 'UPDATE_SETTING_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

}

module.exports = SettingHandler;
