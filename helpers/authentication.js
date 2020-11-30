const Q = require( 'q' );
const Sequelize = require( 'sequelize' );
const Helpers = require( 'nodejs-core/multi_db/helpers' );

const Logger = require( './logger' );
const Account = require( './account' );
const TokenGenerator = require( './token_generator' );
const ChannelModel = require( '@models/channel/channel' );
const UserRole = require( '@models/finance/user/user_role' );
const UserRepository = require( '@models/finance/user/user_repository' );
const LezoEmployee = require( '@models/ext/lezo/lezo_employee' );

const { STATUS_CODE, STATUS_MESSAGE, CONSTANTS } = require( '@resources' );

const Op = Sequelize.Op;

class Authentication extends Helpers.Authentication {

	/**
	* Check activate token
	* @static
	* @param {string} token - Activate user token
	* @return {promise}
	*/
	static async checkActivateToken( token ) {
		const deferred = Q.defer();
		const decoded = TokenGenerator.decrypt( token );

		if ( !decoded || !decoded.channel_id
			|| !decoded.user_id || !decoded.username ) {
			deferred.resolve({
				status	: false,
				message	: 'TOKEN_EXPIRED',
			});
			return deferred.promise;
		}

		const channelId = decoded.channel_id;

		try {
			const channel = await ChannelModel.findByPk( channelId );

			if ( !channel ) {
				deferred.resolve({
					status	: false,
					message	: 'CHANNEL_NOT_FOUND',
				});
				return deferred.promise;
			}

			const userId = decoded.user_id;
			const username = decoded.username;
			const user = await new UserRepository( channelId ).getOne({
				attributes	: [ 'id', 'email', 'is_disabled' ],
				where		: { id: userId, email: username },
			});

			if ( !user ) {
				deferred.resolve({
					status	: false,
					message	: 'USER_NOT_FOUND',
				});
				return deferred.promise;
			}

			if ( !user.is_disabled ) {
				deferred.resolve({
					status	: false,
					message	: 'ACCOUNT_IS_ACTIVATED',
				});
				return deferred.promise;
			}

			deferred.resolve({
				status	: true,
				message	: 'ACTIVATE_TOKEN_VALID',
			});
		} catch ( error ) {
			new Logger().write( 'error', error, channelId );
			deferred.reject( error );
		}

		return deferred.promise;
	}

	/**
	* Activate user
	* @static
	* @param {string} token - Activate user token
	* @param {string} password - Account password
	* @return {promise}
	*/
	static async activateUser( token, password ) {
		const deferred = Q.defer();
		const decoded = TokenGenerator.decrypt( token );

		if ( !decoded || !decoded.channel_id
			|| !decoded.user_id || !decoded.username ) {
			deferred.resolve({
				status	: false,
				message	: 'ACTIVATE_TOKEN_EXPIRED',
			});
			return deferred.promise;
		}

		const channelId = decoded.channel_id;

		try {
			const channel = await ChannelModel.findByPk( channelId );

			if ( !channel ) {
				deferred.resolve({
					status	: false,
					message	: 'CHANNEL_NOT_FOUND',
				});
				return deferred.promise;
			}

			const userId = decoded.user_id;
			const username = decoded.username;
			const user = await new UserRepository( channelId ).getOne({
				attributes	: [ 'id', 'email' ],
				where		: { id: userId, email: username },
			});

			if ( !user ) {
				deferred.resolve({
					status	: false,
					message	: 'USER_NOT_FOUND',
				});
				return deferred.promise;
			}

			// Sync account
			const syncResult = await new Authentication( channelId ).syncAccount( user.email, password );

			if ( !syncResult || !syncResult.status ) {
				deferred.resolve( syncResult );
				return deferred.promise;
			}

			// Set 'ACTIVE' status for user
			user.update( { is_disabled: false } );

			deferred.resolve({
				status	: true,
				message	: 'ACTIVATE_USER_SUCCESS',
			});
		} catch ( error ) {
			new Logger().write( 'error', error, channelId );
			deferred.reject( error );
		}

		return deferred.promise;
	}

	/**
	* Reset password
	* @static
	* @param {string} token - Reset password token
	* @param {string} password - Account password
	* @return {promise}
	*/
	static async resetPassword( token, password ) {
		const deferred = Q.defer();
		const decoded = TokenGenerator.decrypt( token );

		if ( !decoded || !decoded.channel_id
			|| !decoded.user_id || !decoded.username ) {
			deferred.reject({
				status	: STATUS_CODE.UNAUTHORIZED,
				message	: 'RESET_PASSWORD_TOKEN_EXPIRED',
			});
			return deferred.promise;
		}

		const channelId = decoded.channel_id;

		try {
			const channel = await ChannelModel.findByPk( channelId );

			if ( !channel ) {
				deferred.reject({
					status	: STATUS_CODE.NOT_FOUND,
					message	: 'CHANNEL_NOT_FOUND',
				});
				return deferred.promise;
			}

			const userId = decoded.user_id;
			const username = decoded.username;
			const user = await new UserRepository( channelId ).getOne({
				attributes: [
					'id', 'full_name',
					'email', 'is_disabled',
				],
				where: { id: userId, email: username },
			});

			if ( !user ) {
				deferred.reject({
					status	: STATUS_CODE.NOT_FOUND,
					message	: 'USER_NOT_FOUND',
				});
				return deferred.promise;
			}

			// In case user is disabled
			if ( user.is_disabled ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: 'USER_DISABLED',
				});
				return deferred.promise;
			}

			const authentication = new Authentication( channelId );

			// Check account available
			const available = await authentication.checkAccountAvailable( username );

			if ( !available || !available.status ) {
				deferred.reject({
					status	: STATUS_CODE.NOT_FOUND,
					message	: 'ACCOUNT_NOT_AVAILABLE',
				});
				return deferred.promise;
			}

			// Sync account
			const result = await authentication.syncAccount( user.email, password );

			if ( !result || !result.status ) {
				deferred.reject( result );
				return deferred.promise;
			}

			deferred.resolve({
				status	: true,
				message	: 'RESET_PASSWORD_SUCCESS',
			});
		} catch ( error ) {
			new Logger().write( 'error', error, channelId );
			deferred.reject( error );
		}

		return deferred.promise;
	}

	/**
	* Login
	* @override
	* @param {string} channelToken
	* @param {object} accountData - Account authentication data
	* @return {promise}
	*/
	async login( channelToken, accountData ) {
		const deferred = Q.defer();

		try {
			const user = await new UserRepository( this.channelId ).getOne({
				attributes	: [ 'id', 'is_disabled' ],
				where		: { email: accountData.email },
			});

			if ( !user ) {
				deferred.resolve({
					status	: false,
					message	: 'USER_LOGIN_FAIL',
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

			return super.login(
				channelToken,
				{
					username: accountData.email,
					password: accountData.password,
				}
			);
		} catch ( error ) {
			new Logger().write( 'error', error, this.channelId );
			deferred.reject( error );
		}

		return deferred.promise;
	}

	/**
	* Forgot password
	* @param {object} accountData - Account authentication data
	* @return {promise}
	*/
	async forgotPassword( accountData ) {
		const deferred = Q.defer();

		try {
			const user = await new UserRepository( this.channelId ).getOne({
				attributes: [
					'id', 'full_name',
					'email', 'is_disabled',
				],
				where: { email: accountData.email },
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

			// Check account available
			const available = await this.checkAccountAvailable( accountData.email );

			if ( !available || !available.status ) {
				deferred.resolve({
					status	: false,
					message	: 'ACCOUNT_NOT_AVAILABLE',
				});
				return deferred.promise;
			}

			const passwordGenerated = Account.generatePassword();

			// Send password confirm reset email
			user.password = passwordGenerated.hash;
			user.plain_password = passwordGenerated.plain;
			Account.sendPasswordConfirmResetEmail( this.channelId, user );

			deferred.resolve({
				status	: true,
				message	: 'USER_PASSWORD_RESET_SUCCESS',
			});
		} catch ( error ) {
			new Logger().write( 'error', error, this.channelId );
			deferred.reject( error );
		}

		return deferred.promise;
	}

	/**
	* Change password
	* @override
	* @param {int} userId - User id to change password
	* @param {string} currentPassword - Current password
	* @param {string} newPassword - New password
	* @return {promise}
	*/
	async changePassword( userId, currentPassword, newPassword ) {
		const deferred = Q.defer();

		try {
			const user = await new UserRepository( this.channelId ).getOne({
				attributes	: [ 'id', 'email', 'is_disabled' ],
				where		: { id: userId },
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

			// Check account available
			const available = await this.checkAccountAvailable( user.email );

			if ( !available || !available.status ) {
				deferred.resolve({
					status	: false,
					message	: 'ACCOUNT_NOT_AVAILABLE',
				});
				return deferred.promise;
			}

			return super.changePassword( user.email, currentPassword, newPassword );
		} catch ( error ) {
			new Logger().write( 'error', error, this.channelId );
			deferred.reject( error );
		}

		return deferred.promise;
	}

	/**
	* Get user link with account
	* @override
	* @param {string} username
	* @return {promise}
	*/
	async getUser( username ) {
		const deferred = Q.defer();

		try {
			const options = {
				attributes: [
					'id', 'full_name', 'is_owner',
					'email', 'is_disabled', 'lezo_employee_id',
					'avatar', 'role_key',
				],
				where: {
					email		: username,
					is_disabled	: false, // Prevent user disabled
				},
				include: [{ model: await UserRole( this.channelId ) }],
			};
			const hasLezoApp = await this.checkAppAvailable( 'lezo' );
			const userRepository = new UserRepository( this.channelId );

			if ( !hasLezoApp ) return userRepository.getOne( options );

			options.include.push({
				required: false,
				model	: await LezoEmployee( this.channelId ),
				where: {
					status: { [ Op.ne ]: CONSTANTS.LEZO_RESIGNED_EMPLOYEE_STATUS },
				},
			});

			const user = await userRepository.getOne( options );

			if ( user.lezo_employee_id && !user.lezo_employee ) {
				deferred.reject({
					status	: STATUS_CODE.UNAUTHORIZED,
					message	: STATUS_MESSAGE.UNAUTHORIZED,
				});
				return deferred.promise;
			}

			deferred.resolve( user );
		} catch ( error ) {
			new Logger().write( 'error', error, this.channelId );
			deferred.reject( error );
		}

		return deferred.promise;
	}

}

module.exports = Authentication;
