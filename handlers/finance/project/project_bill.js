const Q = require( 'q' );
const Sequelize = require( 'sequelize' );
const _ = require( 'underscore' );
const moment = require( 'moment-timezone' );

const User = require( '@models/finance/user/user' );
const Client = require( '@models/finance/client/client' );
const Project = require( '@models/finance/project/project' );
const ProjectRepository = require( '@models/finance/project/project_repository' );
const ProjectBillRepository = require( '@models/finance/project/project_bill_repository' );
const ProjectSheet = require( '@models/finance/project/project_sheet' );
const ProjectLineItemRepository = require( '@models/finance/project/project_line_item_repository' );
const VOUtility = require( '@models/finance/project/vo_utility' );

const { Logger, Account, Uploader } = require( '@helpers' );
const { STATUS_CODE, STATUS_MESSAGE, CONSTANTS } = require( '@resources' );

const Op = Sequelize.Op;

class ProjectBillHandler {

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
	* Handle get project bills
	* @param {object} queryOptions
	* @return {promise}
	*/
	async handleGetAll( queryOptions = {} ) {
		const deferred = Q.defer();

		try {
			if ( queryOptions && !queryOptions.project_id ) {
				deferred.resolve( [] );
				return deferred.promise;
			}

			const options = {
				where: { project_id: queryOptions.project_id },
				include: {
					model: await Project( this.channelId ),
					attributes: [
						'id', 'manage_by',
						'quotation_status', 'client_payment_term',
					],
				},
			};

			// if ( this.account.isPM() ) options.include.where = { manage_by: this.currentUser.id };

			return new ProjectBillRepository( this.channelId ).getAll( options );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle get all receivables
	* @param {object} queryOptions
	* @return {promise}
	*/
	async handleGetAllReceivables( queryOptions = {} ) {
		const deferred = Q.defer();

		try {
			const options = {
				include: {
					model: await Project( this.channelId ),
					attributes: [
						'id', 'name',
						'client_name', 'client_payment_term',
					],
					include: [
						{
							model: await User( this.channelId ),
							attributes: [
								'id', 'full_name', 'is_disabled',
								'avatar', 'email',
							],
						},
						{
							model		: await Client( this.channelId ),
							attributes	: [ 'id', 'short_name', 'is_disabled' ],
						},
					],
				},
				where: {
					[ Op.and ]: [
						Sequelize.where(
							Sequelize.col( 'project.quotation_status' ),
							CONSTANTS.QUOTATION_STATUS.APPROVED
						),
					],
				},
			};

			// In case user is PM then only get payment of own project
			if ( this.account.isPM() ) {
				options.where[ Op.and ].push(
					Sequelize.where(
						Sequelize.col( 'project.manage_by' ),
						this.currentUser.id
					)
				);
			}

			if ( queryOptions ) {
				// Filter by invoice expected date
				if ( queryOptions.expected_invoice_date_start && queryOptions.expected_invoice_date_end ) {
					const startDate = moment( +queryOptions.expected_invoice_date_start );
					const endDate = moment( +queryOptions.expected_invoice_date_end );

					options.where.expected_invoice_date = {
						[ Op.gte ]: startDate.format( 'YYYY-MM-DD' ),
						[ Op.lte ]: endDate.format( 'YYYY-MM-DD' ),
					};
				}
			}

			return new ProjectBillRepository( this.channelId ).getAll( options );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle create project bill
	* @param {object} data - Project bill data
	* @return {promise}
	*/
	async handleCreate( data ) {
		const deferred = Q.defer();

		try {
			const projectId = data.project_id;

			// Check project valid
			await this._checkProjectValid( projectId );

			// Check total line item
			const totalLineItem = await this._checkTotalLineItem( projectId );
			const maxTotalVat = ( totalLineItem.data.total + totalLineItem.data.vo_total ) * 0.1 + totalLineItem.data.vo_vat;
			const createData = {
				project_id				: projectId,
				name					: data.name,
				total					: data.total,
				total_vat				: data.total_vat,
				expected_invoice_date	: data.expected_invoice_date,
				transfer_type			: data.transfer_type,
			};

			if ( createData.total > totalLineItem.data.total - totalLineItem.data.total_planed + totalLineItem.data.vo_total ) {
				deferred.resolve({
					status	: false,
					message	: 'PROJECT_BILL_OVER',
				});
				return deferred.promise;
			}

			if ( createData.total_vat > maxTotalVat - totalLineItem.data.total_vat_planed ) {
				deferred.resolve({
					status	: false,
					message	: 'PROJECT_BILL_VAT_OVER',
				});
				return deferred.promise;
			}

			return new ProjectBillRepository( this.channelId ).create( createData );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update project bill
	* @param {int} id - Project bill id
	* @param {object} data - Project bill data
	* @return {promise}
	*/
	async handleUpdate( id, data ) {
		const deferred = Q.defer();

		try {
			// Check project bill valid
			const projectBill = await this._checkProjectBillValid(
				id,
				[ CONSTANTS.BILL_STATUS.WAITING ],
				[ 'project_id', 'total' ]
			);
			const updateData = {
				name					: data.name,
				total					: data.total,
				total_vat				: data.total_vat,
				expected_invoice_date	: data.expected_invoice_date,
			};
			const updateOptions = {
				where: { id },
			};
			// Check total line item
			const totalLineItem = await this._checkTotalLineItem( projectBill.data.project_id );
			const maxTotalVat = ( totalLineItem.data.total + totalLineItem.data.vo_total ) * 0.1 + totalLineItem.data.vo_vat;

			if ( updateData.total > totalLineItem.data.total - totalLineItem.data.total_planed
				+ projectBill.data.total + totalLineItem.data.vo_total ) {
				deferred.resolve({
					status	: false,
					message	: 'PROJECT_BILL_OVER',
				});
				return deferred.promise;
			}

			if ( updateData.total_vat > maxTotalVat - totalLineItem.data.total_vat_planed
				+ projectBill.data.total_vat ) {
				deferred.resolve({
					status	: false,
					message	: 'PROJECT_BILL_VAT_OVER',
				});
				return deferred.promise;
			}

			return new ProjectBillRepository( this.channelId ).update( updateData, updateOptions );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update project bill invoice
	* @param {int} id - Project bill id
	* @param {object} data - Project bill data
	* @return {promise}
	*/
	async handleUpdateInvoice( id, data ) {
		const deferred = Q.defer();

		try {
			// Check project bill valid
			const result = await this._checkProjectBillValid(
				id,
				[ CONSTANTS.BILL_STATUS.PROCESSING ],
				[ 'invoices' ]
			);
			const updateData = {
				invoice_date	: data.invoice_date,
				invoice_number	: data.invoice_number,
			};
			const updateOptions = {
				where: { id },
			};
			const invoices = result.data.invoices || [];
			const newInvoice = data.new_invoice;

			if ( newInvoice ) {
				invoices.unshift({
					location	: newInvoice.location,
					path		: newInvoice.path,
					key			: newInvoice.key,
					note		: newInvoice.note,
					created_at	: moment(),
				});
			}

			updateData.invoices = invoices;

			return new ProjectBillRepository( this.channelId ).update( updateData, updateOptions );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update project bill status
	* @param {int} id - Project bill id
	* @param {object} data - Project bill data
	* @return {promise}
	*/
	async handleUpdateStatus( id, data ) {
		const deferred = Q.defer();

		try {
			// Check project bill valid
			const result = await this._checkProjectBillValid(
				id,
				[ CONSTANTS.BILL_STATUS.WAITING, CONSTANTS.BILL_STATUS.PROCESSING, CONSTANTS.BILL_STATUS.INVOICE_SENT ],
				[ 'invoices', 'total', 'expected_invoice_date' ]
			);
			const billStatus = +data.status;

			// In case update status is 'Invoice Sent'
			// But invoices is empty
			if ( _.contains(
				[ CONSTANTS.BILL_STATUS.INVOICE_SENT ],
				billStatus
			) && ( !result.data.invoices || !result.data.invoices.length ) ) {
				deferred.reject({
					status	: STATUS_CODE.BAD_REQUEST,
					message	: STATUS_MESSAGE.BAD_REQUEST,
				});
				return deferred.promise;
			}

			const updateData = { status: billStatus };
			const updateOptions = {
				where: { id },
			};

			// In case update status is 'Money Collected'
			if ( _.contains( [ CONSTANTS.BILL_STATUS.MONEY_COLLECTED ], billStatus ) ) {
				const totalReal = data.total_real;
				const totalVATReal = data.total_vat_real;

				if ( !data.received_date
					|| isNaN( totalReal ) || isNaN( totalVATReal ) || totalReal < 0 || totalVATReal < 0 ) {
					deferred.reject({
						status	: STATUS_CODE.BAD_REQUEST,
						message	: STATUS_MESSAGE.BAD_REQUEST,
					});
					return deferred.promise;
				}

				// Check total line item
				const totalLineItem = await this._checkTotalLineItem( result.data.project_id );
				const maxTotalVat = ( totalLineItem.data.total + totalLineItem.data.vo_total ) * 0.1 + totalLineItem.data.vo_vat;

				if ( totalReal > totalLineItem.data.total - totalLineItem.data.total_received + totalLineItem.data.vo_total ) {
					deferred.resolve({
						status	: false,
						message	: 'PROJECT_BILL_OVER',
					});
					return deferred.promise;
				}

				if ( totalVATReal > maxTotalVat - totalLineItem.data.total_vat_received ) {
					deferred.resolve({
						status	: false,
						message	: 'PROJECT_BILL_VAT_OVER',
					});
					return deferred.promise;
				}

				updateData.total_real = +totalReal;
				updateData.total_vat_real = +totalVATReal;
				updateData.received_date = moment( data.received_date );
			}

			return new ProjectBillRepository( this.channelId ).update( updateData, updateOptions );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update project bill finance note
	* @param {int} id - Project bill id
	* @param {object} data - Project bill data
	* @return {promise}
	*/
	async handleUpdateFinanceNote( id, data ) {
		const deferred = Q.defer();

		try {
			const statusArr = [];

			_.mapObject( CONSTANTS.BILL_STATUS, ( val, key ) => {
				if ( key !== 'MONEY_COLLECTED' ) statusArr.push( val );
			} );

			// Check project bill valid
			await this._checkProjectBillValid( id, statusArr );

			const updateData = { finance_note: data.finance_note };
			const updateOptions = {
				where: { id },
			};

			return new ProjectBillRepository( this.channelId ).update( updateData, updateOptions );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update project bill procedures
	* @param {int} id - Project bill id
	* @param {object} data - Project bill data
	* @return {promise}
	*/
	async handleUpdateProcedures( id, data ) {
		const deferred = Q.defer();

		try {
			// Check project bill valid
			await this._checkProjectBillValid(
				id,
				[ CONSTANTS.BILL_STATUS.WAITING ]
			);

			const procedureData = _.map( data, item => {
				return {
					name		: item.name,
					deadline	: item.deadline,
					status		: item.status,
					proof		: item.proof,
					note		: item.note,
					created_at	: item.created_at,
				};
			} );

			const updateData = { procedures: JSON.stringify( procedureData ) };
			const updateOptions = {
				where: { id },
			};

			return new ProjectBillRepository( this.channelId ).update( updateData, updateOptions );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle delete project bill
	* @param {int} id - Project bill id
	* @return {promise}
	*/
	async handleDelete( id ) {
		const deferred = Q.defer();

		try {
			// Check project bill valid
			await this._checkProjectBillValid(
				id,
				[ CONSTANTS.BILL_STATUS.WAITING ]
			);

			const deleteOptions = {
				where: {
					id,
					invoices		: null,
					invoice_date	: null,
					invoice_number	: null,
					status			: CONSTANTS.PAYMENT_STATUS.WAITING,
				},
			};

			return new ProjectBillRepository( this.channelId ).delete( deleteOptions );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle download invoice
	* @param {object} data - Data to download
	* @return {promise}
	*/
	handleDownloadInvoice( data ) {
		const deferred = Q.defer();

		try {
			const url = new Uploader( this.channelId ).download( data );

			if ( !url ) {
				deferred.resolve({
					status	: false,
					message	: 'DOWNLOAD_INVOICE_FAIL',
				});
				return deferred.promise;
			}

			deferred.resolve({
				status	: true,
				message	: 'DOWNLOAD_INVOICE_SUCCESS',
				data	: url,
			});
		} catch ( error ) {
			new Logger().write( 'error', error, this.channelId );
			deferred.reject( error );
		}

		return deferred.promise;
	}

	/**
	* Handle download procedure
	* @param {object} data - Data to download
	* @return {promise}
	*/
	handleDownloadProcedure( data ) {
		const deferred = Q.defer();

		try {
			const url = new Uploader( this.channelId ).download( data );

			if ( !url ) {
				deferred.resolve({
					status	: false,
					message	: 'DOWNLOAD_PROCEDURE_FAIL',
				});
				return deferred.promise;
			}

			deferred.resolve({
				status	: true,
				message	: 'DOWNLOAD_PROCEDURE_SUCCESS',
				data	: url,
			});
		} catch ( error ) {
			new Logger().write( 'error', error, this.channelId );
			deferred.reject( error );
		}

		return deferred.promise;
	}

	/**
	* Check project bill valid
	* @private
	* @param {int} id - Project bill id
	* @param {Array} status - Project bill status
	* @param {Array} extraAttributes - Project bill extra attributes
	* @return {promise}
	*/
	async _checkProjectBillValid( id, status = null, extraAttributes = null ) {
		const deferred = Q.defer();

		try {
			const options = {
				attributes	: _.union( [ 'id', 'project_id' ], extraAttributes ),
				where		: { id },
			};

			if ( status ) options.where.status = { [ Op.in ]: status };

			const projectBill = await new ProjectBillRepository( this.channelId ).getOne( options );

			if ( !projectBill ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}

			await this._checkProjectValid( projectBill.project_id );

			deferred.resolve({
				status	: true,
				message	: 'PROJECT_BILL_VALID',
				data	: projectBill,
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Check project valid
	* @private
	* @param {int} id - Project id
	* @return {promise}
	*/
	async _checkProjectValid( id ) {
		const deferred = Q.defer();

		try {
			const options = {
				attributes	: [ 'id' ],
				where		: { id, quotation_status: CONSTANTS.QUOTATION_STATUS.APPROVED },
			};

			if ( this.account.isPM() ) options.where.manage_by = this.currentUser.id;

			const project = await new ProjectRepository( this.channelId ).getOne( options );

			if ( !project ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}

			deferred.resolve({
				status	: true,
				message	: 'PROJECT_VALID',
				data	: project,
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Check total line item
	* @private
	* @param {int} id - Project id
	* @return {promise}
	*/
	async _checkTotalLineItem( id ) {
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
					required	: true,
					include: {
						model		: await Project( this.channelId ),
						attributes	: [],
						where		: { id },
					},
				},
			};
			const billOptions = {
				attributes: [
					'id', 'total',
					'total_real', 'status',
				],
				where: { project_id: id },
				include: {
					model		: await Project( this.channelId ),
					attributes	: [],
				},
			};

			if ( this.account.isPM() ) {
				options.include.include.where.manage_by = this.currentUser.id;
				billOptions.include.where = { manage_by: this.currentUser.id };
			}

			const projectLineItem = await new ProjectLineItemRepository( this.channelId ).getOne( options );

			if ( !projectLineItem ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}

			const billPlaned = await new ProjectBillRepository( this.channelId ).getAll( billOptions );
			let totalPlaned = 0;
			let totalVATPlaned = 0;
			let totalReceived = 0;
			let totalVATReceived = 0;

			_.each( billPlaned, item => {
				if ( item.status === CONSTANTS.BILL_STATUS.MONEY_COLLECTED ) {
					totalPlaned += item.total_real;
					totalVATPlaned += item.total_vat_real;
					totalReceived += item.total_real;
					totalVATReceived += item.total_vat_real;
				} else {
					totalPlaned += item.total;
					totalVATPlaned += item.total_vat;
				}
			} );

			// VO Quotation
			const vo = await new VOUtility( this.channelId ).handleSumQuotation( id );

			deferred.resolve({
				status	: true,
				message	: 'PROJECT_VALID',
				data: {
					total				: projectLineItem.dataValues.total || 0,
					total_received		: totalReceived,
					total_vat_received	: totalVATReceived,
					total_planed		: totalPlaned,
					total_vat_planed	: totalVATPlaned,
					vo_total			: vo.total,
					vo_vat				: vo.vat,
				},
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

}

module.exports = ProjectBillHandler;
