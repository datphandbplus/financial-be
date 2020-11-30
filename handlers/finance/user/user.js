const Q = require( 'q' );
const _ = require( 'underscore' );

const UserRepository = require( '@models/finance/user/user_repository' );
const UserRole = require( '@models/finance/user/user_role' );
const LezoEmployee = require( '@models/ext/lezo/lezo_employee' );

const {
	Logger, Account,
	Authentication, Model,
} = require( '@helpers' );
const { STATUS_CODE, STATUS_MESSAGE } = require( '@resources' );

class UserHandler {

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
	* Handle get users
	* @param {object} queryOptions
	* @return {promise}
	*/
	async handleGetAll( queryOptions = {} ) {
		const userRepository = new UserRepository( this.channelId );

		const roleMap = {
			'pm-only': 'PM',
			'qs-only': 'QS',
			'sale-only': 'SALE',
			'purchase-only': 'PURCHASING',
			'construct-only': 'CONSTRUCTION',
		};

		if ( queryOptions && _.contains( _.keys( roleMap ), queryOptions.query_for ) ) {
			return userRepository
			.getAll({
				where: { role_key: roleMap[ queryOptions.query_for ], is_disabled: false },
				attributes: [
					'id', 'full_name',
					'avatar', 'email',
				],
			});
		}

		if ( queryOptions && queryOptions.query_for === 'reference' ) {
			return userRepository
			.getAll({
				where: { is_disabled: false },
				attributes: [
					'id', 'full_name',
					'avatar', 'email',
				],
			});
		}

		const deferred = Q.defer();

		try {
			// In case user is not CEO or Admin
			if ( !this.account.isCEO() && !this.account.isAdmin() ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}

			const options = {
				attributes: [
					'id', 'full_name', 'is_owner',
					'email', 'is_disabled', 'lezo_employee_id',
					'avatar', 'role_key',
				],
				include: [
					{
						model		: await UserRole( this.channelId ),
						attributes	: [ 'key', 'name' ],
					},
				],
			};

			if ( await new Authentication( this.channelId ).checkAppAvailable( 'lezo' ) ) {
				options.include.push({ model: await LezoEmployee( this.channelId ) });
			}

			return userRepository.getAll( options );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle create user
	* @param {object} data
	* @return {promise}
	*/
	async handleCreate( data ) {
		const deferred = Q.defer();

		if ( data.role_key === 'CEO' && !this.account.isSuperAdmin() ) {
			deferred.reject({
				status	: STATUS_CODE.PERMISSION_DENIED,
				message	: STATUS_MESSAGE.PERMISSION_DENIED,
			});
			return deferred.promise;
		}

		try {
			const transaction = await new Model( this.channelId ).transaction();
			const [ user, created ] = await new UserRepository( this.channelId )
			.findOrCreate({
				transaction,
				attributes: [ 'id' ],
				defaults: {
					lezo_employee_id: data.lezo_employee_id,
					role_key		: data.role_key,
					email			: data.email,
					full_name		: data.full_name,
				},
				where: { email: data.email },
			});

			if ( !user || !created ) {
				deferred.resolve({
					status	: false,
					message	: 'USER_ALREADY_EXISTS',
				});
				return deferred.promise;
			}

			// Sync account
			const result = await new Authentication( this.channelId ).syncAccount( user.email );

			if ( !result.status ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'CREATE_USER_FAIL',
				});
				return deferred.promise;
			}

			// Commit transaction
			transaction.commit();

			deferred.resolve({
				status	: true,
				message	: 'CREATE_USER_SUCCESS',
			});

			// Send activation email to new user
			data.is_send_activation && Account.sendActivationEmail(
				this.channelId,
				{ ...data, id: user.id }
			);
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update user
	* @param {int} id
	* @param {object} data
	* @return {promise}
	*/
	async handleUpdate( id, data ) {
		const deferred = Q.defer();

		try {
			const userRepository = new UserRepository( this.channelId );
			const user = await userRepository.getOne({
				attributes: [
					'id', 'is_owner',
					'role_key', 'is_disabled',
				],
				where: { id },
			});

			if ( !user ) {
				deferred.resolve({
					status	: false,
					message	: 'UPDATE_USER_FAIL',
				});
				return deferred.promise;
			}

			if ( user.is_owner
				|| ( user.role_key === 'CEO' && !this.account.isSuperAdmin() ) ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}

			// Update user
			const updateData = {
				full_name	: data.full_name,
				role_key	: data.role_key,
			};
			const updateOptions = {
				where: {
					id,
					is_owner: false, // Prevent user is owner
				},
			};

			return userRepository.update( updateData, updateOptions );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle toggle status
	* @param {string} id
	* @param {object} data
	* @return {promise}
	*/
	async handleToggleStatus( id, data ) {
		const deferred = Q.defer();

		try {
			const userRepository = new UserRepository( this.channelId );
			const user = await userRepository.getOne({
				attributes: [
					'id', 'is_owner',
					'role_key', 'email',
				],
				where: { id },
			});

			if ( !user ) {
				deferred.resolve({
					status	: false,
					message	: 'UPDATE_USER_FAIL',
				});
				return deferred.promise;
			}

			if ( user.is_owner
				|| ( user.role_key === 'CEO' && !this.account.isSuperAdmin() ) ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}

			// Update user
			const updateData = { is_disabled: data.is_disabled };
			const updateOptions = {
				where: {
					id,
					is_owner: false, // Prevent user is owner
				},
			};

			const result = await userRepository.update( updateData, updateOptions );

			if ( !result || !result.status ) {
				deferred.resolve({
					status	: false,
					message	: 'TOGGLE_USER_STATUS_FAIL',
				});
				return deferred.promise;
			}

			deferred.resolve({
				status	: true,
				message	: 'TOGGLE_USER_STATUS_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle delete user
	* @param {int} id
	* @return {promise}
	*/
	async handleDelete( id ) {
		const deferred = Q.defer();

		try {
			const userRepository = new UserRepository( this.channelId );
			const user = await userRepository.getOne({
				attributes	: [ 'id', 'is_owner', 'role_key' ],
				where		: { id },
			});

			if ( !user ) {
				deferred.resolve({
					status	: false,
					message	: 'DELETE_USER_FAIL',
				});
				return deferred.promise;
			}

			if ( user.is_owner
				|| ( user.role_key === 'CEO' && !this.account.isSuperAdmin() ) ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}

			const deleteOptions = {
				where: {
					id,
					is_owner: false, // Prevent user is owner
				},
			};

			return new UserRepository( this.channelId ).delete( deleteOptions );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle send activation email
	* @param {int} id
	* @return {promise}
	*/
	async handleSendActivationEmail( id ) {
		const deferred = Q.defer();

		try {
			const userRepository = new UserRepository( this.channelId );
			const user = await userRepository.getOne({
				attributes: [
					'id', 'email', 'is_disabled',
					'full_name', 'role_key',
				],
				where: {
					id,
					is_owner: false, // Prevent user is owner
				},
			});

			if ( !user ) {
				deferred.resolve({
					status	: false,
					message	: 'SEND_ACTIVATION_EMAIL_FAIL',
				});
				return deferred.promise;
			}

			if ( user.is_owner
				|| ( user.role_key === 'CEO' && !this.account.isSuperAdmin() ) ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}

			deferred.resolve({
				status	: true,
				message	: 'SEND_ACTIVATION_EMAIL_SUCCESS',
			});

			// Set 'UNACTIVE' status for user
			user.update( { is_disabled: true } );

			// Send activation email to new user
			Account.sendActivationEmail(
				this.channelId,
				{
					id			: user.id,
					email		: user.email,
					full_name	: user.full_name,
				}
			);
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

}

module.exports = UserHandler;
