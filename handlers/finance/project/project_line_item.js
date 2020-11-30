const Q = require( 'q' );
const _ = require( 'underscore' );
const moment = require( 'moment-timezone' );
const Excel = require( 'exceljs' );
const path = require( 'path' );
const multer = require( 'multer' );
const tmp = require( 'tmp' );
const fs = require( 'fs' );
const Sequelize = require( 'sequelize' );

const Project = require( '@models/finance/project/project' );
const ProjectSheet = require( '@models/finance/project/project_sheet' );
const ProjectVO = require( '@models/finance/project/project_vo' );
const ProjectLineItemRepository = require( '@models/finance/project/project_line_item_repository' );
const ProjectSheetRepository = require( '@models/finance/project/project_sheet_repository' );
const ProjectRepository = require( '@models/finance/project/project_repository' );
const ProjectLineUtility = require( '@models/finance/project/project_line_utility' );
const ProjectVORepository = require( '@models/finance/project/project_vo_repository' );

const { Logger, Account, Factory, Model } = require( '@helpers' );
const { STATUS_CODE, STATUS_MESSAGE, CONSTANTS } = require( '@resources' );

const Op = Sequelize.Op;
const SERVER = Factory.getConfig( 'server' );

class ProjectLineItemHandler {

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
	* Handle get project line items
	* @param {object} queryOptions
	* @return {promise}
	*/
	async handleGetAll( queryOptions = {} ) {
		const deferred = Q.defer();

		try {
			const projectLineItemRepository = new ProjectLineItemRepository( this.channelId );
			const options = {
				include	: [],
				order	: [[ 'created_at', 'ASC' ]],
			};

			if ( queryOptions ) {
				if ( queryOptions.query_for === 'reference' ) {
					options.attributes = [
						'id', 'name', 'group',
						'child_group', 'project_sheet_id',
					];
				}

				if ( queryOptions.project_id ) {
					options.include = {
						model		: await ProjectSheet( this.channelId ),
						where		: { project_id: queryOptions.project_id },
						attributes	: [],
					};
				}

				if ( queryOptions.project_sheet_id ) {
					options.where = {
						project_sheet_id: queryOptions.project_sheet_id,
					};
				}

				if ( queryOptions.query_for === 'query_for_vo' && queryOptions.vo_id ) {
					options.where = {
						[ Op.or ]: [
							{ vo_add_id: +queryOptions.vo_id },
							{ vo_delete_id: +queryOptions.vo_id },
						],
					};
				}

				if ( queryOptions.query_for === 'valid_vo_remove' && queryOptions.vo_id && queryOptions.project_id ) {
					options.include = [
						{
							model		: await ProjectVO( this.channelId ),
							attributes	: [ 'id', 'status' ],
							as: 'add_by',
						},
						{
							model		: await ProjectVO( this.channelId ),
							attributes	: [ 'id', 'status' ],
							as: 'delete_by',
						},
						{
							model		: await ProjectSheet( this.channelId ),
							attributes	: [],
						},
					];

					options.where = {
						[ Op.and ]: [
							{ [ Op.or ]: [] },
							{
								[ Op.or ]: [
									{
										[ Op.and ]: [
											{
												vo_add_id: {
													[ Op.not ]: null,
												},
											},
										],
									},
									{
										vo_add_id: null,
										vo_delete_id: null,
									},
									{
										vo_delete_id: +queryOptions.vo_id,
									},
								],
							},
						],
					};

					// check for approved items in VO
					options.where[ Op.and ][ 1 ][ Op.or ][ 0 ][ Op.and ].push(
						Sequelize.where(
							Sequelize.col( 'add_by.status' ),
							CONSTANTS.PROJECT_VO_STATUS.APPROVED
						)
					);

					// check for project id
					options.where[ Op.and ][ 0 ][ Op.or ].push(
						Sequelize.where(
							Sequelize.col( 'project_sheet.project_id' ),
							+queryOptions.project_id
						),
						Sequelize.where(
							Sequelize.col( 'add_by.project_id' ),
							+queryOptions.project_id
						),
						Sequelize.where(
							Sequelize.col( 'delete_by.project_id' ),
							+queryOptions.project_id
						)
					);
				}

				if ( this.account.isConstruction() || this.account.isConstructionManager() ) {
					if ( !options.attributes ) options.attributes = [];

					options.attributes.push(
						'id', 'project_sheet_id', 'line_item_category_id',
						'group', 'child_group', 'name',
						'unit', 'note', 'description',
						'image', 'priority', 'created_at',
						'updated_at', 'vo_delete_id', 'vo_add_id'
					);
				}

				return projectLineItemRepository.getAll( options );
			}

			// Prevent get all bills if user is not CEO
			if ( !this.account.isCEO() && ( !_.keys( options.where ).length || !options.include.length ) ) {
				deferred.reject({
					status	: STATUS_CODE.BAD_REQUEST,
					message	: STATUS_MESSAGE.BAD_REQUEST,
				});
				return deferred.promise;
			}

			return projectLineItemRepository.getAll( options );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle create project line item
	* @param {object} data
	* @return {promise}
	*/
	async handleCreate( data ) {
		const deferred = Q.defer();

		try {
			const projectSheetId = data.project_sheet_id;
			const projectVOId = data.vo_add_id;

			if ( !projectSheetId && !projectVOId ) {
				deferred.resolve({
					status	: false,
					message	: 'GET_ITEM_FAIL',
				});
				return deferred.promise;
			}

			// Check project sheet
			if ( !projectVOId ) await this._getProjectSheet( projectSheetId, true );
			else {
				const voValid = await this._checkVO( projectVOId );

				if ( !voValid || !voValid.status ) {
					deferred.resolve({
						status	: false,
						message	: 'GET_VO_FAIL',
					});
					return deferred.promise;
				}
			}

			const createData = {
				project_sheet_id		: projectSheetId,
				vo_add_id				: projectVOId,
				line_item_category_id	: data.line_item_category_id,
				group					: data.group,
				child_group				: data.child_group,
				name					: data.name,
				unit					: data.unit,
				amount					: +data.amount,
				price					: +data.price,
				note					: data.note,
				description				: data.description,
				image					: data.image,
			};

			return new ProjectLineItemRepository( this.channelId ).create( createData );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle check valid vo
	* @param {int} id - Project vo id
	* @param {object} transaction
	* @return {promise}
	*/
	async _checkVO( id, transaction = null ) {
		const deferred = Q.defer();

		try {
			const projectVO = await new ProjectVORepository( this.channelId ).getOne({
				include: {
					model: await Project( this.channelId ),
					where: {
						quotation_status: CONSTANTS.QUOTATION_STATUS.APPROVED,
						qs_by: this.currentUser.id,
					},
				},
				where: {
					id,
					status: {
						[ Op.notIn ]: [ CONSTANTS.PROJECT_VO_STATUS.APPROVED, CONSTANTS.PROJECT_VO_STATUS.WAITING_APPROVAL ],
					},
				},
				transaction,
			});

			if ( !projectVO || !projectVO.id ) {
				deferred.resolve({
					status	: false,
					message	: 'GET_VO_FAIL',
				});
				return deferred.promise;
			}

			deferred.resolve({
				status	: true,
				message	: 'GET_VO_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update project line item
	* @param {int} id
	* @param {object} data
	* @return {promise}
	*/
	async handleUpdate( id, data ) {
		const deferred = Q.defer();

		try {
			const projectSheetId = data.project_sheet_id;

			// Check project sheet
			await this._getProjectSheet( projectSheetId, true );

			const updateData = {
				project_sheet_id		: projectSheetId,
				line_item_category_id	: data.line_item_category_id,
				group					: data.group,
				child_group				: data.child_group,
				name					: data.name,
				unit					: data.unit,
				amount					: +data.amount,
				price					: +data.price,
				note					: data.note,
				description				: data.description,
				image					: data.image,
			};
			const updateOptions = {
				where: { id },
			};

			return new ProjectLineItemRepository( this.channelId ).update( updateData, updateOptions );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle delete project line item
	* @param {int} id - Project line item id
	* @return {promise}
	*/
	async handleDelete( id ) {
		const deferred = Q.defer();

		try {
			const options = {
				where: { id },
				attributes: [
					'id',
					[ Sequelize.literal( 'amount * price' ), 'total_line' ],
					[ Sequelize.col( 'project_sheet->project.id' ), 'project_id' ],
					[ Sequelize.col( 'project_sheet->project.discount_amount' ), 'discount_amount' ],
					[ Sequelize.col( 'project_sheet->project.discount_type' ), 'discount_type' ],
				],
				include: {
					model		: await ProjectSheet( this.channelId ),
					attributes	: [],
					include: {
						model		: await Project( this.channelId ),
						attributes	: [],
					},
				},
			};

			if ( this.account.isPM() ) {
				options.where[ Op.or ] = [
					// Sheet manage by account
					{
						[ Op.and ]: [
							Sequelize.where(
								Sequelize.col( 'project_sheet->project.quotation_status' ),
								{
									[ Op.in ]: [
										CONSTANTS.QUOTATION_STATUS.PROCESSING,
										CONSTANTS.QUOTATION_STATUS.CANCELLED,
									],
								}
							),
						],
					},
					// Project manage by account
					{
						[ Op.and ]: [
							Sequelize.where(
								Sequelize.col( 'project_sheet->project.manage_by' ),
								this.currentUser.id
							),
							Sequelize.where(
								Sequelize.col( 'project_sheet->project.quotation_status' ),
								{
									[ Op.in ]: [
										CONSTANTS.QUOTATION_STATUS.PROCESSING,
										CONSTANTS.QUOTATION_STATUS.CANCELLED,
									],
								}
							),
						],
					},
				];
			}

			const projectLineItemRepository = await new ProjectLineItemRepository( this.channelId );
			const projectLineItem = await projectLineItemRepository.getOne( options );

			if ( !projectLineItem || !projectLineItem.id ) {
				deferred.resolve({
					status	: false,
					message	: 'PROJECT_LINE_ITEM_NOT_FOUND',
				});
				return deferred.promise;
			}

			// Check quotation discount
			const projectData = projectLineItem.dataValues || {};

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

			const deleteOptions = {
				where: { id },
			};

			return projectLineItemRepository.delete( deleteOptions );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update project line item priority
	* @param {int} projectSheetId
	* @param {object} data
	* @return {promise}
	*/
	async handleUpdatePriority( projectSheetId, data ) {
		const deferred = Q.defer();

		try {
			const projectSheet = await this._getProjectSheet( projectSheetId, true );

			if ( !projectSheet || !projectSheet.status ) {
				deferred.resolve( projectSheet );
				return deferred.promise;
			}

			if ( projectSheet.data.project.quotation_status !== CONSTANTS.QUOTATION_STATUS.PROCESSING
				&& projectSheet.data.project.quotation_status !== CONSTANTS.QUOTATION_STATUS.CANCELLED ) {
				deferred.reject({
					status	: STATUS_CODE.BAD_REQUEST,
					message	: STATUS_MESSAGE.BAD_REQUEST,
				});
				return deferred.promise;
			}

			const updateList = [];
			const projectLineItemRepository = new ProjectLineItemRepository( this.channelId );

			_.each( data, item => {
				const updateData = { priority: item.priority };
				const updateOptions = {
					where: { id: item.id },
				};

				updateList.push( projectLineItemRepository.update( updateData, updateOptions ) );
			} );

			const results = await Q.all( updateList );

			if ( _.where( results, { status: false } ).length ) {
				deferred.resolve({
					status: false,
					message: 'UPDATE_PROJECT_LINE_ITEM_PRIORITY_FAIL',
				});
			}

			deferred.resolve({
				status: true,
				message: 'UPDATE_PROJECT_LINE_ITEM_PRIORITY_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle download import file
	* @return {promise}
	*/
	async handleDownloadImportFile() {
		const deferred = Q.defer();

		try {
			const workbook = new Excel.Workbook();
			const sheet = workbook.addWorksheet( 'Template' );
			const uploadDir = Factory.getUploadDir( this.channelId, 'xlsx' );
			const fileId = +moment();
			const filePath = path.join( uploadDir, 'Project_Line_Items_' + fileId + '.xlsx' );
			// For header
			const nameCol = sheet.getColumn( 'A' );
			const descriptionCol = sheet.getColumn( 'B' );
			const unitCol = sheet.getColumn( 'C' );
			const amountCol = sheet.getColumn( 'D' );
			const priceCol = sheet.getColumn( 'E' );
			const noteCol = sheet.getColumn( 'F' );

			// Decorate sheet
			nameCol.width = 50;
			descriptionCol.width = 50;
			unitCol.width = 20;
			amountCol.width = 20;
			priceCol.width = 20;
			noteCol.width = 50;

			_.each( [
				'A1', 'B1', 'C1',
				'D1', 'E1', 'F1',
			], cell => {
				sheet.getCell( cell ).alignment = { horizontal: 'center' };
				sheet.getCell( cell ).font = {
					size	: 12,
					bold	: true,
					color	: { argb: 'FFFFFF' },
				};
				sheet.getCell( cell ).fill = {
					type	: 'pattern',
					pattern	: 'solid',
					fgColor	: { argb: '386190' },
				};
			} );

			// Set header
			nameCol.header = 'DESCRIPTION *';
			descriptionCol.header = 'MATERIAL, ORIGINAL';
			unitCol.header = 'UNIT *';
			amountCol.header = 'QUANTITY *';
			priceCol.header = 'PRICE *';
			noteCol.header = 'REMARKS';

			// Set validation
			for ( let i = 2; i < 1000; i++ ) {
				sheet.getCell( 'D' + i ).dataValidation = {
					type			: 'decimal',
					operator		: 'greaterThan',
					allowBlank		: false,
					formulae		: [ 0 ],
					showErrorMessage: true,
					errorStyle		: 'error',
					errorTitle		: 'Quantity',
					error			: 'The value must greater than 0!',
				};
				sheet.getCell( 'E' + i ).dataValidation = {
					type			: 'decimal',
					operator		: 'greaterThan',
					allowBlank		: false,
					formulae		: [ 0 ],
					showErrorMessage: true,
					errorStyle		: 'error',
					errorTitle		: 'Price',
					error			: 'The value must greater than 0!',
				};
			}

			await workbook.xlsx.writeFile( filePath );

			deferred.resolve({
				status	: true,
				data	: SERVER.URL + '/' + filePath,
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle upload import file and create project line items
	* @param {any} request - Http request to support upload
	* @param {any} response - Http response to support upload
	* @param {object} queryOptions
	* @return {promise}
	*/
	async handleUploadImportFile( request, response, queryOptions = {} ) {
		const deferred = Q.defer();

		try {
			const tmpDir = tmp.dirSync();
			const storage = multer.diskStorage( { destination: tmpDir.name } );
			const upload = multer( { storage } ).any();
			const projectId = request.query.project_id;
			const projectStatusList = [ CONSTANTS.QUOTATION_STATUS.PROCESSING, CONSTANTS.QUOTATION_STATUS.CANCELLED ];

			if ( request.query.vo_id && this.currentUser.role_key === 'QS' ) {
				projectStatusList.push( CONSTANTS.QUOTATION_STATUS.APPROVED );

				const checkVO = await this._checkVO( +request.query.vo_id );

				if ( !checkVO || !checkVO.status ) {
					deferred.resolve({
						status	: false,
						message	: 'GET_VO_FAIL',
					});
					return deferred.promise;
				}
			}

			const options = {
				where: {
					id: projectId,
					quotation_status: {
						[ Op.in ]: projectStatusList,
					},
				},
				attributes: [ 'id' ],
			};

			if ( this.account.isQS() ) options.where.qs_by = this.currentUser.id;

			const project = await new ProjectRepository( this.channelId ).getOne( options );

			if ( !project || !project.id ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}

			// Upload file to tmp folder
			upload( request, response, async err => {
				if ( err
					|| !request.files
					|| !request.files.length
					|| !_.contains(
						[
							'application/ms-excel',
							'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
						],
						request.files[ 0 ].mimetype
					) ) {
					deferred.resolve({
						status	: false,
						message	: 'IMPORT_PROJECT_LINE_ITEMS_FAIL',
					});
					return;
				}

				// Read file xlsx and parse into array
				const file = request.files[ 0 ];
				const workbook = new Excel.Workbook();
				const transaction = await new Model( this.channelId ).transaction();
				const projectSheetRepository = new ProjectSheetRepository( this.channelId );
				const projectLineItemRepository = new ProjectLineItemRepository( this.channelId );
				const projectSheetList = [];
				let nameCol;
				let projectLineItemList = [];

				// Read file
				await workbook.xlsx.readFile( file.path );

				// Loop eachSheet
				workbook.eachSheet( sheet => {
					projectSheetList.push({
						project_id	: projectId,
						name		: sheet.name,
					});

					nameCol = sheet.getColumn( 4 );
					nameCol.eachCell( ( cell, rowNumber ) => {
						if ( rowNumber !== 1 ) {
							const rowValue = {
								sheet_name	: sheet.name,
								name		: sheet.getCell( 'A' + rowNumber ).text || null,
								description	: sheet.getCell( 'B' + rowNumber ).text || null,
								unit		: sheet.getCell( 'C' + rowNumber ).text || null,
								amount		: sheet.getCell( 'D' + rowNumber ).text || null,
								price		: sheet.getCell( 'E' + rowNumber ).text || null,
								note		: sheet.getCell( 'F' + rowNumber ).text || null,
							};

							if ( !rowValue.name || !rowValue.unit || !rowValue.amount || !rowValue.price ) {
								return;
							}

							projectLineItemList.push( rowValue );
						}
					} );
				} );

				let sheetList = [];

				if ( !queryOptions.vo_id ) {
					sheetList = await Q.all(
						_.map( projectSheetList, projectSheet => {
							return projectSheetRepository.findOrCreate( {
								where	: projectSheet,
								default	: projectSheet,
								transaction,
							} );
						} )
					);

					// Check array promiss return
					if ( _.contains( sheetList, null ) ) {
						// If any false, rollback
						transaction.rollback();
						deferred.resolve({
							status	: false,
							message	: 'IMPORT_PROJECT_LINE_ITEMS_FAIL',
						});
						return deferred.promise;
					}
				}

				// Check if replace, delete all current items in sheet
				if ( queryOptions && queryOptions.action === 'replace' && !queryOptions.vo_id ) {
					const dupSheetList = _.map( _.filter( sheetList, item => {
						return item.length === 2 && item[ 1 ] === false;
					} ), _item => _item[ 0 ].id );

					if ( dupSheetList.length ) {
						const resultDelete = await projectLineItemRepository.bulkDelete( {
							where: {
								project_sheet_id: { [ Op.in ]: dupSheetList },
							},
							transaction,
						} );

						// Check promiss return
						if ( resultDelete.status !== true ) {
							// If any false, rollback
							transaction.rollback();
							deferred.resolve({
								status	: false,
								message	: 'IMPORT_PROJECT_LINE_ITEMS_FAIL',
							});
							return deferred.promise;
						}
					}
				}

				const sheetListTemp = _.map( sheetList, item => item[ 0 ] );

				projectLineItemList = _.map( projectLineItemList, projectLineItem => {
					const sheet = _.findWhere( sheetListTemp, { name: projectLineItem.sheet_name });

					projectLineItem.project_sheet_id = !queryOptions.vo_id && sheet
						? sheet.id
						: null;

					projectLineItem.vo_add_id = !isNaN( queryOptions.vo_id ) ? +queryOptions.vo_id : null;

					return projectLineItem;
				} );

				if ( projectLineItemList.length ) {
					const createResult = await projectLineItemRepository.bulkCreate(
						projectLineItemList,
						{ transaction }
					);

					if ( !createResult || !createResult.status ) {
						// Rollback transaction
						transaction.rollback();

						deferred.resolve({
							status	: false,
							message	: 'IMPORT_PROJECT_LINE_ITEMS_FAIL',
						});
						return deferred.promise;
					}
				}

				// Commit transaction
				transaction.commit();

				deferred.resolve({
					status	: true,
					message	: 'IMPORT_PROJECT_LINE_ITEMS_SUCCESS',
					data	: { count: projectLineItemList.length },
				});

				// Async functions
				( () => {
					// Delete file when sheet parsed
					fs.unlink( file.path, () => {} );
				} )();
			} );
		} catch ( error ) {
			new Logger().write( 'error', error, this.channelId );
			deferred.reject( error );
		}

		return deferred.promise;
	}

	/**
	* Get project sheet
	* @private
	* @param {int} id - Project sheet id
	* @param {boolean} isGet - is get line item
	* @return {promise}
	*/
	async _getProjectSheet( id, isGet = false ) {
		const deferred = Q.defer();

		try {
			const options = {
				attributes	: [ 'id' ],
				where		: { id },
				include: {
					model		: await Project( this.channelId ),
					attributes	: [],
					where: {
						quotation_status: {
							[ Op.in ]: [ CONSTANTS.QUOTATION_STATUS.PROCESSING, CONSTANTS.QUOTATION_STATUS.CANCELLED ],
						},
					},
				},
			};

			if ( this.account.isQS() ) {
				options.where[ Op.or ] = [
					Sequelize.where(
						Sequelize.col( 'project.qs_by' ),
						this.currentUser.id
					),
				];
			}

			if ( isGet ) {
				delete options.include.where.quotation_status;
				options.include.attributes = [ 'id', 'quotation_status' ];
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
				data	: projectSheet,
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

}

module.exports = ProjectLineItemHandler;
