const Q = require( 'q' );
const Sequelize = require( 'sequelize' );

const ClientRepository = require( '@models/finance/client/client_repository' );

const { Logger, Account } = require( '@helpers' );
const { STATUS_CODE, STATUS_MESSAGE } = require( '@resources' );

const Op = Sequelize.Op;

class ClientHandler {

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
	* Handle get clients
	* @param {object} queryOptions
	* @return {promise}
	*/
	handleGetAll( queryOptions = {} ) {
		const clientRepository = new ClientRepository( this.channelId );

		if ( queryOptions && queryOptions.query_for === 'reference' ) {
			return clientRepository.getAll({
				attributes	: [ 'id', 'short_name', 'lezo_client_id' ],
				where		: { is_disabled: false },
			});
		}

		const deferred = Q.defer();

		// In case user is not CEO/Admin/Procurement Manager
		if ( !this.account.isCEO()
			&& !this.account.isAdmin()
			&& !this.account.isProcurementManager() ) {
			deferred.reject({
				status	: STATUS_CODE.PERMISSION_DENIED,
				message	: STATUS_MESSAGE.PERMISSION_DENIED,
			});
			return deferred.promise;
		}

		return clientRepository.getAll();
	}

	/**
	* Handle create client
	* @param {object} data - Client data
	* @return {promise}
	*/
	async handleCreate( data ) {
		const deferred = Q.defer();

		try {
			// Create client
			const createData = {
				lezo_client_id		: data.lezo_client_id,
				name				: data.name,
				short_name			: data.short_name,
				phone				: data.phone,
				tax					: data.tax,
				address				: data.address,
				bank_name			: data.bank_name,
				bank_province		: data.bank_province,
				bank_branch			: data.bank_branch,
				bank_account_number	: data.bank_account_number,
				payment_term		: +data.payment_term,
				description			: data.description,
				contact_list		: data.contact_list,
			};

			const [ client, created ] = await new ClientRepository( this.channelId )
			.findOrCreate({
				defaults: createData,
				where: {
					[ Op.or ]: [
						{ name: data.name },
						{
							lezo_client_id: {
								[ Op.ne ]: null,
								[ Op.eq ]: data.lezo_client_id,
							},
						},
					],
				},
			});

			if ( !client || !created ) {
				deferred.resolve({
					status	: false,
					message	: 'CLIENT_ALREADY_EXISTS',
				});
				return deferred.promise;
			}

			deferred.resolve({
				status	: true,
				message	: 'CREATE_CLIENT_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update client
	* @param {int} id - Client id
	* @param {object} data - Client data
	* @return {promise}
	*/
	async handleUpdate( id, data ) {
		const deferred = Q.defer();

		try {
			const clientRepository = await new ClientRepository( this.channelId );
			const client = await clientRepository.getOne({
				where: {
					id: { [ Op.ne ]: id },
					[ Op.or ]: [
						{ name: data.name },
						{
							lezo_client_id: {
								[ Op.ne ]: null,
								[ Op.eq ]: data.lezo_client_id,
							},
						},
					],
				},
			});

			if ( client ) {
				deferred.resolve({
					status	: false,
					message	: 'CLIENT_ALREADY_EXISTS',
				});
				return deferred.promise;
			}

			// Update client
			const updateData = {
				name				: data.name,
				short_name			: data.short_name,
				phone				: data.phone,
				tax					: data.tax,
				address				: data.address,
				bank_name			: data.bank_name,
				bank_province		: data.bank_province,
				bank_branch			: data.bank_branch,
				bank_account_number	: data.bank_account_number,
				payment_term		: +data.payment_term,
				description			: data.description,
				is_disabled			: data.is_disabled,
				contact_list		: data.contact_list,
			};
			const updateOptions = {
				where: { id },
			};

			return clientRepository.update( updateData, updateOptions );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle soft delete client
	* @param {int} id - Client id
	* @return {promise}
	*/
	async handleSoftDelete( id ) {
		const deferred = Q.defer();

		try {
			// Soft delete client
			const deleteOptions = {
				where: { id },
			};
			const result = await new ClientRepository( this.channelId ).delete( deleteOptions );

			if ( !result || !result.status ) {
				deferred.resolve({
					status	: false,
					message	: 'DELETE_CLIENT_FAIL',
				});
				return deferred.promise;
			}

			deferred.resolve({
				status	: true,
				message	: 'DELETE_CLIENT_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

}

module.exports = ClientHandler;
