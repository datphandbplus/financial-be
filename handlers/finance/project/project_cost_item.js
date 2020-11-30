const Q = require( 'q' );
const _ = require( 'underscore' );
const moment = require( 'moment-timezone' );
const Excel = require( 'exceljs' );
const path = require( 'path' );
const multer = require( 'multer' );
const tmp = require( 'tmp' );
const fs = require( 'fs' );
const Sequelize = require( 'sequelize' );

const Vendor = require( '@models/finance/vendor/vendor' );
const VendorCategory = require( '@models/finance/vendor/vendor_category' );
const ProjectCostItemRepository = require( '@models/finance/project/project_cost_item_repository' );
const ProjectLineItem = require( '@models/finance/project/project_line_item' );
const ProjectRepository = require( '@models/finance/project/project_repository' );
const ProjectCostModification = require( '@models/finance/project/project_cost_modification' );
const ProjectCostModificationRepository = require( '@models/finance/project/project_cost_modification_repository' );
const ProjectCostUtility = require( '@models/finance/project/project_cost_utility' );
const ProjectPurchaseOrder = require( '@models/finance/project/project_purchase_order' );
const Project = require( '@models/finance/project/project' );
const ProjectVORepository = require( '@models/finance/project/project_vo_repository' );
const ProjectVO = require( '@models/finance/project/project_vo' );

const { Logger, Account, Factory, Model } = require( '@helpers' );
const { STATUS_CODE, STATUS_MESSAGE, CONSTANTS } = require( '@resources' );

const Op = Sequelize.Op;
const SERVER = Factory.getConfig( 'server' );

class ProjectCostItemHandler {

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
	* Handle get project cost items
	* @param {object} queryOptions
	* @return {promise}
	*/
	async handleGetAll( queryOptions = {} ) {
		const deferred = Q.defer();

		try {
			const projectCostItemRepository = new ProjectCostItemRepository( this.channelId );
			const options = {
				include: [
					{
						model		: await Vendor( this.channelId ),
						attributes	: [ 'id', 'short_name', 'is_disabled' ],
						required	: false,
						include: {
							model		: await VendorCategory( this.channelId ),
							attributes	: [ 'id', 'name' ],
						},
					},
					{
						model	: await ProjectLineItem( this.channelId ),
						required: false,
					},
				],
			};

			if ( queryOptions && queryOptions.project_id ) {
				const projectInclude = {
					model		: await Project( this.channelId ),
					attributes	: [],
				};

				if ( this.account.isQS() ) projectInclude.where = { qs_by: this.currentUser.id };
				if ( this.account.isPurchasing() ) projectInclude.where = { purchase_by: this.currentUser.id };
				if ( this.account.isPM() ) projectInclude.where = { manage_by: this.currentUser.id };
				if ( this.account.isSale() ) projectInclude.where = { sale_by: this.currentUser.id };
				if ( this.account.isConstruction() ) projectInclude.where = { construct_by: this.currentUser.id };

				if ( this.account.isConstruction() || this.account.isConstructionManager() ) {
					options.attributes = [
						'id', 'project_id', 'project_line_item_id',
						'vendor_id', 'cost_item_category_id', 'project_purchase_order_id',
						'name', 'unit', 'amount',
						'bk_amount', 'is_extra', 'note',
						'description', 'image', 'created_at',
						'updated_at', 'is_parent', 'parent_id',
						'vo_delete_id', 'vo_add_id',
					];
				}

				options.include.push( projectInclude );

				options.where = {
					project_id	: queryOptions.project_id,
					is_extra	: false,
					parent_id	: null,
				};

				if ( queryOptions.query_for === 'valid_vo_remove' && queryOptions.vo_id ) {
					options.include.push(
						{
							model: await ProjectVO( this.channelId ),
							as: 'add_cost_by',
						},
						{
							model: await ProjectVO( this.channelId ),
							as: 'delete_cost_by',
						},
						{
							model: await ProjectPurchaseOrder( this.channelId ),
							attributes: [ 'id', 'name' ],
						}
					);

					options.where[ Op.or ] = [
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
					];

					// check for approved items in VO
					options.where[ Op.or ][ 0 ][ Op.and ].push(
						Sequelize.where(
							Sequelize.col( 'add_cost_by.status' ),
							CONSTANTS.PROJECT_VO_STATUS.APPROVED
						)
					);

					return projectCostItemRepository.getAll( options );
				}

				if ( queryOptions.query_for === 'query_for_vo' && queryOptions.vo_id ) {
					options.where.is_parent = false;
					options.where.project_purchase_order_id = null;

					options.where[ Op.or ] = [
						{ vo_add_id: queryOptions.vo_id },
						{ vo_delete_id: queryOptions.vo_id },
					];

					delete options.where.is_parent;
					delete options.where.is_extra;

					return projectCostItemRepository.getAll( options );
				}

				if ( queryOptions.query_for === 'cost_modified' ) {
					return new ProjectCostUtility( this.channelId ).handleSumProjectCost( queryOptions.project_id );
				}

				// getting list of cost items had: project approved & modification invalid & both origin and extra items
				if ( queryOptions.query_for === 'quotation_approved' ) {
					const costModificationOptions = {
						model: await ProjectCostModification( this.channelId ),
						attributes: [
							'id', 'status', 'old_amount',
							'old_price', 'new_amount', 'new_price',
						],
					};

					if ( this.account.isConstruction() || this.account.isConstructionManager() ) {
						costModificationOptions.attributes = [ 'id', 'status' ];
					}

					options.include.push( costModificationOptions );
					delete options.where.is_extra;
					delete options.where.parent_id;

					options.where.vo_delete_id = null;
				}

				if ( queryOptions.query_for === 'had_vendor_approved' && queryOptions.vendor_id ) {
					options.where.is_parent = false;
					options.where.project_purchase_order_id = null;
					options.where.vendor_id = queryOptions.vendor_id;

					options.include.push({
						model		: await ProjectCostModification( this.channelId ),
						attributes	: [ 'id', 'status' ],
					});

					delete options.where.is_extra;
					delete options.where.parent_id;
				}

				if ( queryOptions.query_for === 'pending_items' ) {
					options.where.project_purchase_order_id = { [ Op.ne ]: null };
					options.include.push( {
						model		: await ProjectCostModification( this.channelId ),
						attributes	: [ 'id', 'status' ],
					},
					{
						model		: await ProjectPurchaseOrder( this.channelId ),
						attributes	: [ 'id', 'name' ],
						where		: { status: CONSTANTS.PURCHASE_ORDER_STATUS.REJECTED },
					} );
					options.where.is_parent = false;
					delete options.where.is_extra;
					delete options.where.parent_id;
				}

				options.include.push(
					{
						model: await ProjectVO( this.channelId ),
						as: 'add_cost_by',
						attributes: [ 'id', 'status' ],
					},
					{
						model: await ProjectVO( this.channelId ),
						as: 'delete_cost_by',
						attributes: [ 'id', 'status' ],
					}
				);

				options.where[ Op.or ] = [
					{ vo_add_id: null },
					{
						[ Op.and ]: [
							{ vo_add_id: { [ Op.ne ]: null } },
							Sequelize.where(
								Sequelize.col( 'add_cost_by.status' ),
								CONSTANTS.PROJECT_VO_STATUS.APPROVED
							),
						],
					},
				];

				return projectCostItemRepository.getAll( options );
			}

			if ( !this.account.isCEO() ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}
			return projectCostItemRepository.getAll( options );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle create project cost item
	* @param {object} data
	* @return {promise}
	*/
	async handleCreate( data ) {
		const deferred = Q.defer();

		try {
			const projectRepository = new ProjectRepository( this.channelId );
			const transaction = await new Model( this.channelId ).transaction();
			const projectCostItemRepository = new ProjectCostItemRepository( this.channelId );
			const createData = {
				project_id				: data.project_id,
				project_line_item_id	: data.project_line_item_id,
				cost_item_category_id	: data.cost_item_category_id,
				vendor_id				: data.vendor_id,
				name					: data.name,
				unit					: data.unit,
				amount					: +data.amount,
				price					: +data.price,
				note					: data.note,
				description				: data.description,
				image					: data.image,
				parent_id				: data.parent_id,
			};
			const projectOptions = {
				where		: { id: data.project_id },
				attributes	: [ 'id', 'quotation_status' ],
				transaction,
			};

			if ( this.account.isQS() ) projectOptions.where.qs_by = this.currentUser.id;

			const project = await projectRepository.getOne( projectOptions );

			if ( !project || !project.id ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve( project );
				return deferred.promise;
			}

			if ( project.quotation_status === CONSTANTS.QUOTATION_STATUS.APPROVED ) {
				if ( data.vo_id ) {

					const checkVO = await this._checkVO( +data.vo_id, transaction );

					if ( !checkVO || !checkVO.status ) {
						// Rollback transaction
						transaction.rollback();

						deferred.resolve({
							status	: false,
							message	: 'GET_VO_FAIL',
						});
						return deferred.promise;
					}

					createData.vo_add_id = +data.vo_id;

					const resultCreate = await projectCostItemRepository.create( createData, { transaction } );

					if ( !resultCreate || !resultCreate.status ) {
						// Rollback transaction
						transaction.rollback();

						deferred.resolve({
							status	: false,
							message	: 'GET_VO_FAIL',
						});
						return deferred.promise;
					}
				} else {
					createData.is_extra = true;

					if ( createData.parent_id ) {
						const childProjectCostItem = await projectCostItemRepository.create( createData, { transaction } );

						if ( !childProjectCostItem || !childProjectCostItem.status ) {
							// Rollback transaction
							transaction.rollback();

							deferred.resolve( childProjectCostItem );
							return deferred.promise;
						}

						const updateParentCostItem = await projectCostItemRepository.update(
							{ is_parent: true },
							{
								where: {
									id			: createData.parent_id,
									vo_delete_id: null,
								},
								transaction,
							}
						);

						if ( !updateParentCostItem || !updateParentCostItem.status ) {
							// Rollback transaction
							transaction.rollback();

							deferred.resolve( updateParentCostItem );
							return deferred.promise;
						}

						const checkChildren = await this._checkChildrenAutoValid(
							childProjectCostItem.data,
							createData.parent_id,
							transaction
						);

						if ( !checkChildren || !checkChildren.status ) {
							// Rollback transaction
							transaction.rollback();

							deferred.resolve( checkChildren );
							return deferred.promise;
						}
					} else {
						const projectCostItem = await projectCostItemRepository.create( createData, { transaction } );

						if ( !projectCostItem || !projectCostItem.status ) {
							// Rollback transaction
							transaction.rollback();

							deferred.resolve( projectCostItem );
							return deferred.promise;
						}

						const result = await new ProjectCostUtility( this.channelId )
						.handleModify( {
							id			: projectCostItem.data.id,
							vendor_id	: data.vendor_id,
							amount		: +data.amount,
							price		: +data.price,
						},
						transaction,
						true );

						if ( !result || !result.status ) {
							// Rollback transaction
							transaction.rollback();

							deferred.resolve( result );
							return deferred.promise;
						}
					}
				}

				// Commit transaction
				transaction.commit();

				deferred.resolve({
					status	: true,
					message	: 'CREAT_PROJECT_COST_ITEM_SUCCESS',
				});
				return deferred.promise;
			}

			const result = await projectCostItemRepository.create( createData, { transaction } );

			if ( !result || !result.status ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve( result );
				return deferred.promise;
			}

			// Commit transaction
			transaction.commit();

			deferred.resolve({
				status	: true,
				message	: 'CREAT_PROJECT_COST_ITEM_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}
		return deferred.promise;
	}

	/**
	* Handle update project cost item
	* @param {int} id
	* @param {object} data
	* @return {promise}
	*/
	async handleUpdate( id, data ) {
		const deferred = Q.defer();

		try {
			const transaction = await new Model( this.channelId ).transaction();
			const projectRepository = new ProjectRepository( this.channelId );
			const projectCostItemRepository = new ProjectCostItemRepository( this.channelId );
			const options = {
				where: {
					id: data.project_id,
					quotation_status: data.parent_id
						? CONSTANTS.QUOTATION_STATUS.APPROVED
						: {
							[ Op.in ]: [
								CONSTANTS.QUOTATION_STATUS.PROCESSING,
								CONSTANTS.QUOTATION_STATUS.CANCELLED,
							],
						},
				},
				attributes: [ 'id' ],
				transaction,
			};

			if ( this.account.isQS() ) options.where.qs_by = this.currentUser.id;

			const project = await projectRepository.getOne( options );

			if ( !project || !project.id ) {
				// Rollback transaction
				transaction.rollback();

				deferred.reject({
					status	: STATUS_CODE.BAD_REQUEST,
					message	: STATUS_MESSAGE.BAD_REQUEST,
				});
				return deferred.promise;
			}

			if ( data.parent_id ) {
				const projectCostItem = await projectCostItemRepository.getOne({
					where: { id },
					transaction,
				});

				if ( !projectCostItem || !projectCostItem.id ) {
					// Rollback transaction
					transaction.rollback();

					deferred.resolve( projectCostItem );
					return deferred.promise;
				}

				if ( projectCostItem.vendor_id !== data.vendor_id ) {
					const updateVendorResult = await projectCostItemRepository.update( { vendor_id: data.vendor_id }, {
						where: { id: projectCostItem.id },
						transaction,
					} );

					if ( !updateVendorResult || !updateVendorResult.status ) {
						// Rollback transaction
						transaction.rollback();

						deferred.resolve({
							status	: false,
							message	: 'UPDATE_PROJECT_COST_VENDOR_FAIL',
						});
						return deferred.promise;
					}
				}

				projectCostItem.price = data.price;
				projectCostItem.amount = data.amount;
				projectCostItem.updating = true;

				const checkChildren = await this._checkChildrenAutoValid( projectCostItem, projectCostItem.parent_id, transaction );

				if ( !checkChildren || !checkChildren.status ) {
					// Rollback transaction
					transaction.rollback();

					deferred.resolve( checkChildren );
					return deferred.promise;
				}

				// Commit transaction
				transaction.commit();

				deferred.resolve({
					status	: true,
					message	: 'UPDATE_CHILD_PROJECT_COST_ITEM_SUCCESS',
				});
				return deferred.promise;
			}

			const updateData = {
				project_id				: data.project_id,
				project_line_item_id	: data.project_line_item_id,
				cost_item_category_id	: data.cost_item_category_id,
				vendor_id				: data.vendor_id,
				name					: data.name,
				unit					: data.unit,
				amount					: +data.amount,
				price					: +data.price,
				note					: data.note,
				description				: data.description,
				image					: data.image,
			};
			const updateOptions = {
				where: {
					id,
					project_id: data.project_id,
				},
				transaction,
			};

			const updateResult = await projectCostItemRepository.update( updateData, updateOptions );

			if ( !updateResult || !updateResult.status ) {
				// Rollback transaction
				transaction.rollback();

				deferred.resolve( updateResult );
				return deferred.promise;
			}

			// Commit transaction
			transaction.commit();

			deferred.resolve({
				status	: true,
				message	: 'UPDATE_PROJECT_COST_ITEM_SUCCESS',
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Handle update project cost item
	* @param {int} id
	* @param {object} data
	* @return {promise}
	*/
	async handleUpdateVendor( id, data ) {
		const deferred = Q.defer();

		try {
			const projectRepository = new ProjectRepository( this.channelId );
			const updateData = { vendor_id: data.vendor_id };
			const updateOptions = {
				where: {
					id,
					project_id					: data.project_id,
					project_purchase_order_id	: null,
				},
			};
			const options = {
				where		: { id: data.project_id },
				attributes	: [ 'id' ],
			};

			if ( this.account.isQS() ) options.where.qs_by = this.currentUser.id;
			if ( this.account.isPurchasing() ) options.where.purchase_by = this.currentUser.id;

			const project = await projectRepository.getOne( options );

			if ( !project || !project.id ) {
				deferred.reject({
					status	: STATUS_CODE.BAD_REQUEST,
					message	: STATUS_MESSAGE.BAD_REQUEST,
				});
				return deferred.promise;
			}

			return new ProjectCostItemRepository( this.channelId ).update( updateData, updateOptions );
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
			const filePath = path.join( uploadDir, 'Project_Cost_Items_' + fileId + '.xlsx' );
			// For header
			const nameCol = sheet.getColumn( 'A' );
			const unitCol = sheet.getColumn( 'B' );
			const amountCol = sheet.getColumn( 'C' );
			const priceCol = sheet.getColumn( 'D' );
			const totalCol = sheet.getColumn( 'E' );
			const noteCol = sheet.getColumn( 'F' );

			// Decorate sheet
			nameCol.width = 50;
			unitCol.width = 20;
			amountCol.width = 20;
			priceCol.width = 20;
			totalCol.width = 20;
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
			nameCol.header = 'NAME *';
			unitCol.header = 'UNIT *';
			amountCol.header = 'QUANTITY *';
			priceCol.header = 'PRICE *';
			totalCol.header = 'TOTAL';
			noteCol.header = 'REMARKS';

			// Set validation
			for ( let i = 2; i < 1000; i++ ) {
				sheet.getCell( 'C' + i ).dataValidation = {
					type			: 'decimal',
					operator		: 'greaterThan',
					allowBlank		: false,
					formulae		: [ 0 ],
					showErrorMessage: true,
					errorStyle		: 'error',
					errorTitle		: 'Quantity',
					error			: 'The value must greater than 0!',
				};
				sheet.getCell( 'D' + i ).dataValidation = {
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
	* Handle upload import file and create project cost items
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
						message	: 'IMPORT_PROJECT_COST_ITEMS_FAIL',
					});
					return;
				}

				// Read file xlsx and parse into array
				const file = request.files[ 0 ];
				const workbook = new Excel.Workbook();

				let nameCol;

				const transaction = await new Model( this.channelId ).transaction();
				const projectCostItemList = [];

				// Read file
				await workbook.xlsx.readFile( file.path );

				// Loop eachSheet
				workbook.eachSheet( sheet => {
					nameCol = sheet.getColumn( 2 );
					nameCol.eachCell( ( cell, rowNumber ) => {
						if ( rowNumber !== 1 ) {
							const name = sheet.getCell( 'A' + rowNumber ).text;
							const unit = sheet.getCell( 'B' + rowNumber ).text;
							const amount = sheet.getCell( 'C' + rowNumber ).text;
							const price = sheet.getCell( 'D' + rowNumber ).text;
							const note = sheet.getCell( 'F' + rowNumber ).text;

							if ( !name || !unit || !amount || !price ) {
								return;
							}
							const rowValue = {
								name, unit, amount,
								price, note,
								project_id: projectId,
							};
							projectCostItemList.push( rowValue );
						}
					} );
				} );

				if ( projectCostItemList.length ) {
					const projectCostItemRepository = new ProjectCostItemRepository( this.channelId );

					// Check if replace, delete all current items in project
					if ( queryOptions && !queryOptions.vo_id && queryOptions.action === 'replace' ) {
						const resultDelete = await projectCostItemRepository.bulkDelete( {
							where: { project_id: projectId },
							transaction,
						} );

						// Check promiss return
						if ( resultDelete.status !== true ) {
							// If any false, rollback
							transaction.rollback();
							deferred.resolve({
								status	: false,
								message	: 'IMPORT_PROJECT_COST_ITEMS_FAIL',
							});
							return deferred.promise;
						}
					}

					const createResult = await projectCostItemRepository.bulkCreate(
						_.map( projectCostItemList, cost => ({
							...cost,
							vo_add_id: !isNaN( queryOptions.vo_id ) ? +queryOptions.vo_id : null,
						})),
						{ transaction }
					);

					if ( !createResult || !createResult.status ) {
						// Rollback transaction
						transaction.rollback();
						deferred.resolve({
							status	: false,
							message	: 'IMPORT_PROJECT_COST_ITEMS_FAIL',
						});
						return deferred.promise;
					}
				}

				// Commit transaction
				transaction.commit();

				deferred.resolve({
					status	: true,
					message	: 'IMPORT_PROJECT_COST_ITEMS_SUCCESS',
					data	: { count: projectCostItemList.length },
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
	* Private check Child cost item valid or not and set to cost modification table
	* @param {object} projectCostItem
	* @param {int} parentId
	* @param {object} transaction
	* @return {promise}
	*/
	async _checkChildrenAutoValid( projectCostItem, parentId, transaction ) {
		const deferred = Q.defer();

		try {
			const projectCostModificationRepository = new ProjectCostModificationRepository( this.channelId );

			const projectCostItemRepository = new ProjectCostItemRepository( this.channelId );
			const parentProjectCostItem = await projectCostItemRepository.getOne({
				transaction,
				where: { id: parentId },
				include: {
					model: await ProjectCostModification( this.channelId ),
					where: {
						status: CONSTANTS.COST_MODIFICATION_STATUS.WAITING,
					},
					required: false,
				},
			});

			if ( !parentProjectCostItem
				|| !parentProjectCostItem.id
				|| ( parentProjectCostItem.project_cost_modifications
					&& parentProjectCostItem.project_cost_modifications.length )
				|| ( parentProjectCostItem.is_extra
					&& ( parentProjectCostItem.bk_price === null ) )
			) {
				deferred.resolve({
					status	: false,
					message	: 'GET_PARENT_FAIL',
				});
				return deferred.promise;
			}

			const childrenProjectCostItem = await projectCostItemRepository.getAll({
				transaction,
				where: { parent_id: parentId },
				include: {
					model: await ProjectCostModification( this.channelId ),
					order: [[ 'id', 'DESC' ]],
					required: false,
				},
				order: [[ 'id', 'ASC' ]],
			});

			if ( !childrenProjectCostItem || !childrenProjectCostItem.length ) {
				deferred.resolve({
					status	: false,
					message	: 'GET_CHILDREN_FAIL',
				});
				return deferred.promise;
			}

			const needUpdateModificatedItems = [];

			let total = 0;
			_.each( childrenProjectCostItem, costItem => {
				if ( costItem.project_cost_modifications
					&& costItem.project_cost_modifications.length
					&& costItem.project_cost_modifications[ 0 ].status === CONSTANTS.COST_MODIFICATION_STATUS.REJECTED
					&& ( costItem.bk_price === null ) ) return;

				if ( costItem.id === projectCostItem.id ) {
					total += projectCostItem.amount * projectCostItem.price;
					projectCostItem.bk_amount = costItem.amount;
					projectCostItem.bk_price = costItem.price;
				} else {
					total += costItem.amount * costItem.price;

					if ( total <= ( parentProjectCostItem.amount * parentProjectCostItem.price )
						&& costItem.project_cost_modifications
						&& costItem.project_cost_modifications.length
						&& costItem.project_cost_modifications[ 0 ].status === CONSTANTS.COST_MODIFICATION_STATUS.WAITING ) {
						needUpdateModificatedItems.push({
							id					: costItem.project_cost_modifications[ 0 ].id,
							old_price			: costItem.project_cost_modifications[ 0 ].old_price,
							old_amount			: costItem.project_cost_modifications[ 0 ].old_amount,
							new_price			: costItem.project_cost_modifications[ 0 ].new_price,
							new_amount			: costItem.project_cost_modifications[ 0 ].new_amount,
							status				: CONSTANTS.COST_MODIFICATION_STATUS.VALID,
							project_cost_item_id: costItem.project_cost_modifications[ 0 ].project_cost_item_id,
						});
					}
				}
			});

			if ( !projectCostItem.deleting ) {
				const modificationWaiting = await projectCostModificationRepository.getOne({
					attributes: [ 'id' ],
					where: {
						project_id			: projectCostItem.project_id,
						project_cost_item_id: projectCostItem.id,
						status				: CONSTANTS.COST_MODIFICATION_STATUS.WAITING,
					},
				});

				if ( modificationWaiting ) {
					deferred.resolve({
						status	: false,
						message	: 'PROJECT_COST_MODIFICATION_IS_WAITING',
					});
					return deferred.promise;
				}

				const createData = {
					project_id			: projectCostItem.project_id,
					project_cost_item_id: projectCostItem.id,
					name				: projectCostItem.name,
					unit				: projectCostItem.unit,
					old_amount			: projectCostItem.updating
						? ( projectCostItem.bk_amount !== null )
							? projectCostItem.bk_amount
							: 0
						: 0,
					old_price			: ( projectCostItem.bk_price !== null )
						? projectCostItem.bk_price
						: projectCostItem.price,
					new_amount			: projectCostItem.amount,
					new_price			: projectCostItem.price,
					status				: CONSTANTS.COST_MODIFICATION_STATUS.WAITING,
				};

				if ( total <= ( parentProjectCostItem.amount * parentProjectCostItem.price ) ) {
					if ( !parentProjectCostItem.is_parent ) {
						const updateParentCostItem = await projectCostItemRepository.update(
							{ is_parent: true },
							{ where: { id: parentId }, transaction }
						);

						if ( !updateParentCostItem || !updateParentCostItem.status ) {
							deferred.resolve( updateParentCostItem );
							return deferred.promise;
						}
					}

					if ( projectCostItem.updating ) {
						const updateProjectCostItem = await projectCostItemRepository.update({
							price	: projectCostItem.price,
							amount	: projectCostItem.amount,
						},
						{
							transaction,
							where: { id: projectCostItem.id },
						});

						if ( !updateProjectCostItem || !updateProjectCostItem.status ) {
							deferred.resolve({
								status	: false,
								message	: 'UPDATE_FAIL',
							});
							return deferred.promise;
						}
					} else {
						const updateProjectCostItem = await projectCostItemRepository.update({
							bk_price	: projectCostItem.price,
							bk_amount	: 0,
						},
						{
							where: { id: projectCostItem.id },
							transaction,
						});

						if ( !updateProjectCostItem || !updateProjectCostItem.status ) {
							deferred.resolve({
								status	: false,
								message	: 'UPDATE_FAIL',
							});
							return deferred.promise;
						}
						createData.status = CONSTANTS.COST_MODIFICATION_STATUS.VALID;
					}
				}

				// Check over total extra cost fee
				const project = await new ProjectRepository( this.channelId ).getOne({
					attributes: [ 'id', 'total_extra_fee' ],
					where: {
						id: createData.project_id,
					},
					transaction,
				});

				if ( !project || !project.id ) {
					// Rollback transaction
					transaction.rollback();

					deferred.resolve( project );
					return deferred.promise;
				}

				const baseTotal = ( !projectCostItem.id ? 0 : +( projectCostItem.bk_amount || projectCostItem.amount ) )
					* +( projectCostItem.bk_price || projectCostItem.price );
				const sumResult = await new ProjectCostUtility( this.channelId ).handleSumProjectCost( createData.project_id, transaction );
				const maxTotalExtraFee = sumResult.base * +project.total_extra_fee / 100;
				const newTotal = createData.new_amount * createData.new_price;

				// New total over max total extra fee
				// increase total
				if ( sumResult.modified - sumResult.base - baseTotal + newTotal > maxTotalExtraFee ) {
					createData.status = CONSTANTS.COST_MODIFICATION_STATUS.WAITING;
				}

				if ( ( createData.old_amount * createData.old_price ) !== ( createData.new_amount * createData.new_price ) ) {
					const resultCreateModification = await projectCostModificationRepository.create( createData, { transaction } );

					if ( !resultCreateModification || !resultCreateModification.status ) {
						deferred.resolve({
							status	: false,
							message	: 'CREATE_FAIL',
						});
						return deferred.promise;
					}
				}
			}

			if ( needUpdateModificatedItems.length ) {
				const resultBulkUpdateModification = await projectCostModificationRepository
				.bulkCreate( needUpdateModificatedItems, { updateOnDuplicate: [ 'status' ], transaction } );

				if ( !resultBulkUpdateModification || !resultBulkUpdateModification.status ) {
					deferred.resolve({
						status	: false,
						message	: 'UPDATE_FAIL',
					});
					return deferred.promise;
				}

				const dataBulkCreate = [];

				_.each( needUpdateModificatedItems, item => {
					dataBulkCreate.push({
						id			: item.project_cost_item_id,
						bk_price	: item.old_price,
						bk_amount	: item.old_amount,
					});
				});

				const resultBulkUpdateCost = await projectCostItemRepository
				.bulkCreate(
					dataBulkCreate,
					{
						updateOnDuplicate: [ 'bk_price', 'bk_amount' ],
						transaction,
					}
				);

				if ( !resultBulkUpdateCost || !resultBulkUpdateCost.status ) {
					deferred.resolve({
						status	: false,
						message	: 'UPDATE_FAIL',
					});
					return deferred.promise;
				}
			}

			deferred.resolve({
				status	: true,
				message	: 'CREATE_SUCCESS',
			});
		} catch ( error ) {
			new Logger().write( 'error', error, this.channelId );
			deferred.reject( error );
		}

		return deferred.promise;
	}

	/**
	* Handle delete project cost item
	* @param {int} id - Project Cost item id
	* @return {promise}
	*/
	async handleDelete( id ) {
		const deferred = Q.defer();

		try {
			const transaction = await new Model( this.channelId ).transaction();
			const projectCostItemRepository = new ProjectCostItemRepository( this.channelId );

			const options = {
				where: { id },
				include: {
					model: await Project( this.channelId ),
					attributes: [ 'id', 'quotation_status' ],
				},
				transaction,
			};

			if ( this.account.isQS() ) options.include.where = { qs_by: this.currentUser.id };

			const projectCostItem = await projectCostItemRepository.getOne( options );

			if ( projectCostItem
				&& projectCostItem.id
				&& projectCostItem.project
				&& (
					projectCostItem.project.quotation_status === CONSTANTS.QUOTATION_STATUS.WAITING_APPROVAL
					|| (
						projectCostItem.project.quotation_status === CONSTANTS.QUOTATION_STATUS.APPROVED
						&& (
							!projectCostItem.is_extra
							|| ( projectCostItem.is_extra && projectCostItem.is_parent )
						)
					)
				)
			) {
				transaction.rollback();

				deferred.reject({
					status	: STATUS_CODE.BAD_REQUEST,
					message	: STATUS_MESSAGE.BAD_REQUEST,
				});
				return deferred.promise;
			}

			const deleteResult = await projectCostItemRepository.delete({
				where: { id },
				transaction,
			});

			if ( !deleteResult || !deleteResult.status ) {
				transaction.rollback();

				deferred.resolve({
					status	: false,
					message	: 'DELETE_PROJECT_COST_ITEM_FAIL',
				});
				return deferred.promise;
			}

			if ( projectCostItem.parent_id ) {
				const childrenProjectCostItem = await projectCostItemRepository.getAll({
					where: { parent_id: projectCostItem.parent_id },
					transaction,
				});

				if ( !childrenProjectCostItem ) {
					transaction.rollback();

					deferred.resolve({
						status	: false,
						message	: 'GET_CHILDREN_FAIL',
					});
					return deferred.promise;
				}

				if ( !childrenProjectCostItem.length ) {
					const updateResult = await projectCostItemRepository.update(
						{
							is_parent: false,
						},
						{
							where: { id: projectCostItem.parent_id },
							transaction,
						}
					);

					if ( !updateResult || !updateResult.status ) {
						transaction.rollback();

						deferred.resolve({
							status	: false,
							message	: 'UPDATE_PARENT_FAIL',
						});
						return deferred.promise;
					}
				} else {
					projectCostItem.deleting = true;
					const checkChildren = await this._checkChildrenAutoValid( projectCostItem, projectCostItem.parent_id, transaction );

					if ( !checkChildren || !checkChildren.status ) {
						// Rollback transaction
						transaction.rollback();

						deferred.resolve( checkChildren );
						return deferred.promise;
					}
				}
			}

			transaction.commit();
			deferred.resolve({
				status	: true,
				message	: 'DELETE_PROJECT_COST_ITEM_SUCCESS',
			});
		} catch ( error ) {
			new Logger().write( 'error', error, this.channelId );
			deferred.reject( error );
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

}

module.exports = ProjectCostItemHandler;
