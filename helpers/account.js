const express = require( 'express' );
const _ = require( 'underscore' );
const Q = require( 'q' );
const Helpers = require( 'nodejs-core/multi_db/helpers' );

const Factory = require( './factory' );
const Mailer = require( './mailer' );
const Logger = require( './logger' );
const TokenGenerator = require( './token_generator' );
const Uploader = require( './uploader' );
const WebURL = require( './web_url' );
const ChannelModel = require( '@models/channel/channel' );
const UserRepository = require( '@models/finance/user/user_repository' );

const SERVER = Factory.getConfig( 'server' );
const app = express();

class Account extends Helpers.Account {

	/**
	* @contructor
	* @param {object} currentUser
	*/
	constructor( currentUser ) {
		super();

		this.currentUser = currentUser;
	}

	/**
	* General Methods
	*/

	/**
	* Check current user is super admin
	* @return {boolean}
	*/
	isSuperAdmin() {
		return this.isCEO()
			&& this.currentUser
			&& this.currentUser.is_owner;
	}

	/**
	* Check current user is CEO
	* @return {boolean}
	*/
	isCEO() {
		return this.hasRole( 'CEO' );
	}

	/**
	* Check current user is Admin
	* @return {boolean}
	*/
	isAdmin() {
		return this.hasRole( 'ADMIN' );
	}

	/**
	* Check current user is CFO
	* @return {boolean}
	*/
	isCFO() {
		return this.hasRole( 'CFO' );
	}

	/**
	* Check current user is General Accountant
	* @return {boolean}
	*/
	isGeneralAccountant() {
		return this.hasRole( 'GENERAL_ACCOUNTANT' );
	}

	/**
	* Check current user is Liabilities Accountant
	* @return {boolean}
	*/
	isLiabilitiesAccountant() {
		return this.hasRole( 'LIABILITIES_ACCOUNTANT' );
	}

	/**
	* Check current user is PM
	* @return {boolean}
	*/
	isPM() {
		return this.hasRole( 'PM' );
	}

	/**
	* Check current user is Sale
	* @return {boolean}
	*/
	isSale() {
		return this.hasRole( 'SALE' );
	}

	/**
	* Check current user is Procurement Manager
	* @return {boolean}
	*/
	isProcurementManager() {
		return this.hasRole( 'PROCUREMENT_MANAGER' );
	}

	/**
	* Check current user is QS
	* @return {boolean}
	*/
	isQS() {
		return this.hasRole( 'QS' );
	}

	/**
	* Check current user is Purchasing
	* @return {boolean}
	*/
	isPurchasing() {
		return this.hasRole( 'PURCHASING' );
	}

	/**
	* Check current user is Construction Manager
	* @return {boolean}
	*/
	isConstructionManager() {
		return this.hasRole( 'CONSTRUCTION_MANAGER' );
	}

	/**
	* Check current user is Construction
	* @return {boolean}
	*/
	isConstruction() {
		return this.hasRole( 'CONSTRUCTION' );
	}

	/**
	* Check current user is Finance
	* @return {boolean}
	*/
	isFinance() {
		return this.hasRole( 'FINANCE' );
	}

	/**
	* Check current user has role
	* @param {string} roleKey - Role key to check
	* @return {boolean}
	*/
	hasRole( roleKey ) {
		return this.currentUser && this.currentUser.role_key === roleKey;
	}

	/**
	* Check current user has roles
	* @param {array} roleKeys - Role keys to check
	* @return {boolean}
	*/
	hasRoles( roleKeys ) {
		return this.currentUser
			&& this.currentUser.role_key
			&& _.include( roleKeys, this.currentUser.role_key );
	}

	/**
	* Account Methods
	*/

	/**
	* Update avatar
	* @param {string} channelId
	* @param {string} avatar - User avatar to update
	* @return {promise}
	*/
	async updateAvatar( channelId, avatar ) {
		const deferred = Q.defer();

		try {
			const user = await new UserRepository( channelId ).getOne({
				attributes	: [ 'id', 'is_disabled' ],
				where		: { id: this.currentUser.id },
			});

			if ( !user ) {
				deferred.resolve({
					status	: false,
					message	: 'USER_NOT_FOUND',
				});
				return deferred.promise;
			}

			// In case user is disabled
			if ( user.is_disabled ) {
				deferred.resolve({
					status	: false,
					message	: 'USER_DISABLED',
				});
				return deferred.promise;
			}

			const affectedRow = await user.update( { avatar } );

			if ( !affectedRow ) {
				deferred.resolve({
					status	: false,
					message	: 'UPDATE_AVATAR_FAIL',
				});
				return deferred.promise;
			}

			deferred.resolve({
				status	: true,
				message	: 'UPDATE_AVATAR_SUCCESS',
			});
		} catch ( error ) {
			new Logger().write( 'error', error, channelId );
			deferred.reject( error );
		}

		return deferred.promise;
	}

	/**
	* Upload avatar
	* @param {string} channelId
	* @param {any} request - Http request to support upload to local
	* @param {any} response - Http response to support upload to local
	* @return {promise}
	*/
	async uploadAvatar( channelId, request, response ) {
		const deferred = Q.defer();

		try {
			const result = await new Uploader( channelId ).upload( request, response, 'avatars' );

			if ( !result
				|| !result.status
				|| !result.data
				|| !result.data[ 0 ] ) {
				deferred.resolve({
					status	: false,
					message	: 'UPLOAD_AVATAR_FAIL',
				});
				return deferred.promise;
			}

			return this.updateAvatar( channelId, result.data[ 0 ].location );
		} catch ( error ) {
			new Logger().write( 'error', error, channelId );
			deferred.reject( error );
		}

		return deferred.promise;
	}

	/**
	* Send activation email
	* @static
	* @param {string} channelId
	* @param {object} userData
	* @return {void}
	*/
	static async sendActivationEmail( channelId, userData ) {
		try {
			const channel = await ChannelModel.findByPk( channelId );

			if ( !channel ) return;

			let token = TokenGenerator.encrypt(
				{
					username	: userData.email,
					user_id		: userData.id,
					channel_id	: channel.id,
				},
				true,
				'7d'
			);

			token = encodeURIComponent( token );

			const workspaceUrl = SERVER.MULTI_CHANNELS
				? WebURL.addSubdomain( SERVER.CLIENT, channel.id )
				: SERVER.CLIENT;
			const activationUrl = workspaceUrl + '/activate?token=' + token;

			app.set( 'view engine', 'jade' );
			app.render(
				'../views/emails/activation.jade',
				{
					invite_name		: userData.full_name,
					invite_account	: userData.email,
					invite_link		: activationUrl,
					channel_id		: channel.id,
					channel_name	: channel.name,
					workspace_url	: workspaceUrl,
					app_name		: SERVER.APP_NAME,
					app_logo		: SERVER.APP_LOGO,
					homepage		: SERVER.CLIENT,
				},
				( error, html ) => {
					if ( error ) {
						new Logger().write( 'error', error, channelId );
						return;
					}

					new Mailer().send({
						html,
						to		: userData.email,
						subject	: '[Activation] Activate ' + SERVER.APP_NAME + ' Account',
					});
				}
			);
		} catch ( error ) {
			new Logger().write( 'error', error, channelId );
		}
	}

	/**
	* Send reset password confirmation email
	* @static
	* @param {string} channelId
	* @param {object} userData
	* @return {void}
	*/
	static async sendPasswordConfirmResetEmail( channelId, userData ) {
		try {
			const channel = await ChannelModel.findByPk( channelId );

			if ( !channel ) return;

			let token = TokenGenerator.encrypt(
				{
					username	: userData.email,
					user_id		: userData.id,
					channel_id	: channel.id,
				},
				true,
				'7d'
			);

			token = encodeURIComponent( token );

			const workspaceUrl = SERVER.MULTI_CHANNELS
				? WebURL.addSubdomain( SERVER.CLIENT, channel.id )
				: SERVER.CLIENT;
			const activationUrl = workspaceUrl + '/activate?token=' + token + '&action=reset';

			app.set( 'view engine', 'jade' );
			app.render(
				'../views/emails/password-confirm-reset.jade',
				{
					user_full_name	: userData.full_name,
					confirm_link	: activationUrl,
					channel_id		: channel.id,
					channel_name	: channel.name,
					workspace_url	: workspaceUrl,
					app_name		: SERVER.APP_NAME,
					app_logo		: SERVER.APP_LOGO,
					homepage		: SERVER.CLIENT,
				},
				( error, html ) => {
					if ( error ) {
						new Logger().write( 'error', error, channelId );
						return;
					}

					new Mailer().send({
						html,
						to		: userData.email,
						subject	: '[Confirmation] Reset Your ' + SERVER.APP_NAME + ' Password',
					});
				}
			);
		} catch ( error ) {
			new Logger().write( 'error', error, channelId );
		}
	}

}

module.exports = Account;
