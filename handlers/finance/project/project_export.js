const Q = require( 'q' );
const _ = require( 'underscore' );
const Sequelize = require( 'sequelize' );
const moment = require( 'moment-timezone' );
const Excel = require( 'exceljs' );
const path = require( 'path' );
const sizeOf = require( 'image-size' );

const Client = require( '@models/finance/client/client' );
const User = require( '@models/finance/user/user' );
const ProjectRepository = require( '@models/finance/project/project_repository' );
const ProjectSheet = require( '@models/finance/project/project_sheet' );
const ProjectLineItem = require( '@models/finance/project/project_line_item' );
const SettingRepository = require( '@models/finance/setting/setting_repository' );

const { Logger, Account, Factory } = require( '@helpers' );

const SERVER = Factory.getConfig( 'server' );

const { CONSTANTS, STATUS_CODE, STATUS_MESSAGE } = require( '@resources' );

const Op = Sequelize.Op;

class ProjectExportHandler {

	/**
	* @constructor
	* @param {string} channelId
	* @param {object} userData
	*/
	constructor( channelId, userData = null ) {
		this.channelId = channelId;
		this.currentUser = userData;
		this.account = new Account( userData );
		this.setting = [];
		this.maxImageWidth = 20;
	}

	/**
	* Handle export project
	* @param {int} id - Project id
	* @return {promise}
	*/
	async handleExport( id ) {
		const deferred = Q.defer();

		try {
			const options = {
				where: {
					id,
					quotation_status: CONSTANTS.QUOTATION_STATUS.APPROVED,
				},
				attributes: [
					'id', 'manage_by', 'client_id',
					'client_name', 'name', 'quotation_status',
					'contact', 'project_start', 'project_end',
					'quotation_date', 'valid_duration', 'project_status',
					'project_code', 'exchange_rate',
				],
				include: [
					{
						model		: await Client( this.channelId ),
						attributes	: [ 'id', 'short_name', 'is_disabled' ],
					},
					{
						model: await User( this.channelId ),
						attributes: [
							'id', 'full_name', 'avatar',
							'email', 'is_disabled',
						],
					},
					{
						model: await ProjectSheet( this.channelId ),
						attributes: [
							'id', 'name',
							'description', 'note',
						],
						include: [
							{
								model: await ProjectLineItem( this.channelId ),
								attributes: [
									'id', 'group', 'child_group',
									'name', 'unit', 'amount', 'price',
									'note', 'description',
									'priority', 'image',
								],
							},
						],
					},
				],
			};

			if ( this.account.isPM() ) options.where.manage_by = this.currentUser.id;
			if ( this.account.isSale() ) options.where.sale_by = this.currentUser.id;
			if ( this.account.isQS() ) options.where.qs_by = this.currentUser.id;
			if ( this.account.isPurchasing() ) options.where.purchase_by = this.currentUser.id;

			const project = await new ProjectRepository( this.channelId ).getOne( options );

			// No project to export
			if ( !project ) {
				deferred.reject({
					status	: STATUS_CODE.PERMISSION_DENIED,
					message	: STATUS_MESSAGE.PERMISSION_DENIED,
				});
				return deferred.promise;
			}

			// Get setting
			this.setting = await this._getSetting();

			// Create xlsx directory
			const uploadDir = Factory.getUploadDir( this.channelId, 'xlsx/' + moment().format( 'YYYY-MM-DD' ) );

			const workbook = new Excel.Workbook();
			const masterSheet = workbook.addWorksheet( 'Master' );
			const fileId = +moment();
			const filePath = path.join( uploadDir, 'project_export_' + fileId + '.xlsx' );
			const logo = await this._getLogo( workbook );

			this._addLogo( masterSheet, logo );
			this._addProjectInfo( masterSheet, project );

			// After Project Info
			masterSheet.mergeCells( 'A8:E8' );

			// Master row
			const masterQuotationCell = masterSheet.getCell( 'A8' );
			masterQuotationCell.value = 'MASTER QUOTATION';
			this._setCenterStyle( masterQuotationCell );

			// No cell
			const noCell = masterSheet.getCell( 'A9' );
			noCell.value = 'No.';
			this._setCenterStyle( noCell );

			// Sheet cell
			const itemCell = masterSheet.getCell( 'B9' );
			itemCell.value = 'Sheet';
			this._setCenterStyle( itemCell );

			// Desc cell
			const descCell = masterSheet.getCell( 'C9' );
			descCell.value = 'Description';
			this._setCenterStyle( descCell );

			// Total cost cell
			const totalCostCell = masterSheet.getCell( 'D9' );
			totalCostCell.value = 'Total Cost';
			this._setCenterStyle( totalCostCell );

			// Note cell
			const noteCell = masterSheet.getCell( 'E9' );

			noteCell.value = 'NOTE';
			this._setCenterStyle( noteCell );

			// SHEET INFO
			const funcs = [];

			_.each( project.project_sheets, ( sheetData, index ) => {
				const totalCost = this._calcualteTotalCost( sheetData.project_line_items );

				const sheetInfo = masterSheet.addRow([
					index + 1,
					sheetData.name,
					sheetData.description,
					totalCost * project.exchange_rate,
					sheetData.note,
				]);

				// No
				sheetInfo.getCell( 'A' ).alignment = {
					horizontal	: 'center',
					vertical	: 'middle',
				};
				// Sheet
				sheetInfo.getCell( 'B' ).alignment = {
					vertical: 'middle',
					wrapText: true,
				};
				// Description
				sheetInfo.getCell( 'C' ).alignment = {
					vertical: 'middle',
					wrapText: true,
				};
				// Total cost
				sheetInfo.getCell( 'D' ).numFmt = '#,##0';
				sheetInfo.getCell( 'D' ).alignment = { vertical: 'middle' };
				// Note
				sheetInfo.getCell( 'E' ).alignment = {
					vertical: 'middle',
					wrapText: true,
				};

				// Add Sheet detail
				funcs.push( this._addProjectSheet( workbook, project, sheetData.dataValues, logo ) );
			} );

			await Q.all( funcs );

			// FOOTER INFO
			const lastRow = masterSheet.rowCount;

			// Total row
			const totalRowIndex = lastRow + 1;
			const totalRow = masterSheet.getRow( totalRowIndex );

			masterSheet.mergeCells( 'A' + totalRowIndex + ':C' + totalRowIndex );
			const totalCell = totalRow.getCell( 'A' );
			totalCell.value = 'TOTAL (VAT excluded)';
			this._setRightStyle( totalCell );

			const sumTotalCell = totalRow.getCell( 'D' );
			sumTotalCell.value = { formula: 'SUM(D9:D' + lastRow + ')' };
			sumTotalCell.numFmt = '#,##0';
			this._setRightStyle( sumTotalCell );
			this._setRightStyle( totalRow.getCell( 'E' ) ); // NOTE cell

			// VAT 10%
			const vatRowIndex = lastRow + 2;
			const vatRow = masterSheet.getRow( vatRowIndex );

			masterSheet.mergeCells( 'A' + vatRowIndex + ':C' + vatRowIndex );
			const vatCell = vatRow.getCell( 'A' );
			vatCell.value = 'VAT';
			this._setRightStyle( vatCell );

			const vatMoneyCell = vatRow.getCell( 'D' );
			vatMoneyCell.value = {
				formula: 'D' + totalRowIndex
					+ '*0.1'
					+ '*' + project.exchange_rate,
			};
			vatMoneyCell.numFmt = '#,##0';
			this._setRightStyle( vatMoneyCell );
			this._setRightStyle( vatRow.getCell( 'E' ) ); // NOTE cell

			// Sum With VAT
			const sumWithVATIndex = lastRow + 3;
			const sumWithVATRow = masterSheet.getRow( sumWithVATIndex );

			masterSheet.mergeCells( 'A' + sumWithVATIndex + ':C' + sumWithVATIndex );
			const sumWithVATCell = sumWithVATRow.getCell( 'A' );
			sumWithVATCell.value = 'SUM (With VAT)';
			this._setRightStyle( sumWithVATCell );

			const sumWithVATMoneyCell = sumWithVATRow.getCell( 'D' );
			sumWithVATMoneyCell.value = { formula: 'D' + totalRowIndex + '+D' + vatRowIndex };
			sumWithVATMoneyCell.numFmt = '#,##0';
			this._setRightStyle( sumWithVATMoneyCell );
			this._setRightStyle( sumWithVATRow.getCell( 'E' ) ); // NOTE

			// Quotation note
			const quotationNote = _.findWhere( this.setting, { key: 'QUOTATION_NOTE' } );

			if ( quotationNote ) {
				const quotationNoteIndex = lastRow + 4;
				const quotationNoteRow = masterSheet.getRow( quotationNoteIndex );

				masterSheet.mergeCells( 'A' + quotationNoteIndex + ':E' + quotationNoteIndex );
				const quotationNoteCell = quotationNoteRow.getCell( 'A' );
				quotationNoteCell.value = quotationNote.value;
				quotationNoteCell.alignment = { vertical: 'top' };

				masterSheet.getRow( quotationNoteIndex ).height = 40;
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
	* Get setting
	* @private
	* @return {promise}
	*/
	_getSetting() {
		return new SettingRepository( this.channelId ).getAll({
			attributes: [ 'key', 'value' ],
			where: {
				key: {
					[ Op.in ]: [
						'BRANCH_LOGO', 'BRANCH_PRIMARY_COLOR', 'BRANCH_SECONDARY_COLOR',
						'QUOTATION_NOTE', 'CONTRACT_SIGNER_FULL_NAME',
						'CONTRACT_SIGNER_TITLE', 'EXCHANGE_RATE',
					],
				},
			},
		});
	}

	/**
	* Add project sheet
	* @private
	* @param {object} workbook
	* @param {object} project
	* @param {object} data
	* @param {object} logo
	* @return {void}
	*/
	async _addProjectSheet( workbook, project, data, logo ) {
		const deferred = Q.defer();

		try {
			const projectSheet = workbook.addWorksheet( data.name );

			this._addLogo( projectSheet, logo );
			this._addProjectSheetInfo( projectSheet, project );

			// After Project Info
			projectSheet.mergeCells( 'A6:I6' );

			const sheetNameCell = projectSheet.getCell( 'A6' );
			sheetNameCell.value = data.name;
			this._setCenterStyle( sheetNameCell );

			const noCell = projectSheet.getCell( 'A7' );
			noCell.value = 'No.';
			this._setCenterStyle( noCell );

			const itemCell = projectSheet.getCell( 'B7' );
			itemCell.value = 'Name';
			this._setCenterStyle( itemCell );

			const descCell = projectSheet.getCell( 'C7' );
			descCell.value = 'Description';
			this._setCenterStyle( descCell );

			const unitCostCell = projectSheet.getCell( 'D7' );
			unitCostCell.value = 'Unit';
			this._setCenterStyle( unitCostCell );

			const amountCell = projectSheet.getCell( 'E7' );
			amountCell.value = 'Amount';
			this._setCenterStyle( amountCell );

			const priceCell = projectSheet.getCell( 'F7' );
			priceCell.value = 'Price';
			this._setCenterStyle( priceCell );

			const totalCostCell = projectSheet.getCell( 'G7' );
			totalCostCell.value = 'Total';
			this._setCenterStyle( totalCostCell );

			const noteCell = projectSheet.getCell( 'H7' );
			noteCell.value = 'NOTE';
			this._setCenterStyle( noteCell );

			const imageCell = projectSheet.getCell( 'I7' );
			imageCell.value = 'Image';
			this._setCenterStyle( imageCell );

			// SHEET INFO
			const results = _.sortBy( data.project_line_items, item => [ item.priority, item.group, item.child_group ].join( '-' ) );
			const checkGroup = {};
			const checkChildGroup = {};

			let lastRowIndex = 8;

			const final = [];
			const funcs = [];

			// Sort by Group, Child Group
			_.each( results, item => {
				let index = 0;
				let tempIndex = 0;

				index = _.findIndex( final, { group: item.group } );

				if ( item.group ) {
					if ( item.child_group ) {
						index = _.findLastIndex( final, { group: item.group } );
						tempIndex = _.findLastIndex( final, { group: item.group, child_group: item.child_group } );

						if ( tempIndex > -1 ) {
							index = tempIndex;
						} else {
							index = Math.max( index, final.length - 1 );
						}
					} else {
						tempIndex = _.findLastIndex( final, { group: item.group, child_group: item.child_group } );

						if ( tempIndex === -1 && index > 0 ) {
							index--;
						} else {
							index = Math.max( index, tempIndex );
						}
					}
				} else {
					if ( item.child_group ) {
						index = _.findLastIndex( final, { group: item.group } );
						tempIndex = _.findLastIndex( final, { group: item.group, child_group: item.child_group } );

						if ( tempIndex > -1 ) {
							index = tempIndex;
						} else {
							index = Math.max( index, tempIndex );
						}
					} else {
						tempIndex = _.findLastIndex( final, { group: item.group, child_group: item.child_group } );

						if ( tempIndex === -1 && index >= 0 ) {
							index--;
						} else {
							index = Math.max( index, tempIndex );
						}
					}
				}

				final.splice( ++index, 0, item );
				funcs.push( this._getImage( workbook, item ) );
			} );

			// Get images
			await Q.all( funcs );

			_.each( final, lineItem => {
				let hasGroup;
				let hasChildGroup;
				let groupName = '';
				let childGroupName = '';

				// Has Group
				if ( lineItem.group ) {
					hasGroup = true;

					groupName = lineItem.group;

					if ( !checkGroup[ groupName ] ) {
						checkGroup[ groupName ] = {
							sum_index	: _.clone( lastRowIndex ),
							length		: 1,
						};

						const groupRow = projectSheet.getRow( lastRowIndex );
						groupRow.getCell( 'B' ).value = groupName;

						// Set style for Group row
						[
							'A', 'B', 'C',
							'D', 'E', 'F',
							'G', 'H', 'I',
						].map( key => {
							projectSheet.getCell( key + lastRowIndex ).fill = {
								type	: 'pattern',
								pattern	:'solid',
								fgColor	:{ argb: '00D9D9D9' },
							};
						});

						lastRowIndex++;
					}

					// Has Child Group
					if ( lineItem.child_group ) {
						hasChildGroup = true;

						childGroupName = lineItem.child_group;

						if ( !checkChildGroup[ childGroupName ] ) {
							checkChildGroup[ childGroupName ] = {
								sum_index	: _.clone( lastRowIndex ),
								length		: 1,
							};

							const childGroupRow = projectSheet.getRow( lastRowIndex );
							childGroupRow.getCell( 'B' ).value = childGroupName;

							// Set style for Group row
							[
								'A', 'B', 'C',
								'D', 'E', 'F',
								'G', 'H', 'I',
							].map( key => {
								projectSheet.getCell( key + lastRowIndex ).fill = {
									type	: 'pattern',
									pattern	:'solid',
									fgColor	:{ argb: '00E9E9E9' },
								};
							});

							lastRowIndex++;
						}

						// Set Group length
						checkGroup[ groupName ].length++;
					}
				} else { // No Group
					// Has Child Group
					if ( lineItem.child_group ) {
						hasChildGroup = true;

						childGroupName = lineItem.child_group;

						if ( !checkChildGroup[ childGroupName ] ) {
							checkChildGroup[ childGroupName ] = {
								sum_index	: _.clone( lastRowIndex ),
								length		: 1,
							};

							const childGroupRow = projectSheet.getRow( lastRowIndex );
							childGroupRow.getCell( 'B' ).value = childGroupName;

							// Set style for Group row
							[
								'A', 'B', 'C',
								'D', 'E', 'F',
								'G', 'H', 'I',
							].map( key => {
								projectSheet.getCell( key + lastRowIndex ).fill = {
									type	: 'pattern',
									pattern	:'solid',
									fgColor	:{ argb: '00E9E9E9' },
								};
							});

							lastRowIndex++;
						}
					}
				}

				const lineItemRow = projectSheet.getRow( lastRowIndex );

				// No Group
				if ( !hasGroup ) {
					if ( !checkChildGroup[ 'null' ] ) {
						checkChildGroup[ 'null' ] = { length: 1 };
					}

					lineItemRow.getCell( 'A' ).value = checkChildGroup[ 'null' ].length++;
				} else if ( !hasChildGroup ) { // No Child Group
					if ( !checkChildGroup[ groupName + '-null' ] ) {
						checkChildGroup[ groupName + '-null' ] = { length: 1 };
					}

					lineItemRow.getCell( 'A' ).value = checkChildGroup[ groupName + '-null' ].length++;
				} else { // Has Group and Child Group
					if ( !checkChildGroup[ groupName + '-' + childGroupName ] ) {
						checkChildGroup[ groupName + '-' + childGroupName ] = { length: 1 };
					}

					lineItemRow.getCell( 'A' ).value = checkChildGroup[ groupName + '-' + childGroupName ].length++;
				}

				// No
				lineItemRow.getCell( 'A' ).alignment = {
					horizontal	: 'center',
					vertical	: 'middle',
				};
				// Name
				lineItemRow.getCell( 'B' ).value = lineItem.name;
				lineItemRow.getCell( 'B' ).alignment = {
					vertical: 'middle',
					wrapText: true,
				};
				// Description
				lineItemRow.getCell( 'C' ).value = lineItem.description;
				lineItemRow.getCell( 'C' ).alignment = {
					vertical: 'middle',
					wrapText: true,
				};
				// Unit
				lineItemRow.getCell( 'D' ).value = lineItem.unit;
				lineItemRow.getCell( 'D' ).alignment = {
					vertical: 'middle',
					wrapText: true,
				};
				// Amount
				const sheetAmountCell = lineItemRow.getCell( 'E' );
				sheetAmountCell.value = lineItem.amount;
				sheetAmountCell.numFmt = '#,##0';
				sheetAmountCell.alignment = { vertical: 'middle' };
				// Price
				const sheetPriceCell = lineItemRow.getCell( 'F' );
				sheetPriceCell.value = lineItem.price * project.exchange_rate;
				sheetPriceCell.numFmt = '#,##0';
				sheetPriceCell.alignment = { vertical: 'middle' };
				// Total
				const sheetTotalCell = lineItemRow.getCell( 'G' );
				sheetTotalCell.value = { formula: 'E' + lastRowIndex + '*F' + lastRowIndex };
				sheetTotalCell.numFmt = '#,##0';
				sheetTotalCell.alignment = { vertical: 'middle' };
				// Note
				lineItemRow.getCell( 'H' ).value = lineItem.note;
				lineItemRow.getCell( 'H' ).alignment = {
					vertical: 'middle',
					wrapText: true,
				};
				// Image
				const image = _.findWhere( funcs, { line_item_id: lineItem.id } );
				this._addImage( projectSheet, image, lastRowIndex );

				lastRowIndex++;
			} );

			// Add SUM for Child Group
			_.each( checkChildGroup, item => {
				if ( !item.sum_index ) return;

				const sumIndex = item.sum_index;
				const groupRow = projectSheet.getRow( sumIndex );

				const sheetSumGroupCell = groupRow.getCell( 'G' );
				sheetSumGroupCell.value = { formula: 'SUBTOTAL(9,G' + ( sumIndex + 1 ) + ':G' + ( sumIndex + item.length ) +')' };
				sheetSumGroupCell.numFmt = '#,##0';
			} );

			// Add SUM for Group
			_.each( checkGroup, item => {
				const sumIndex = item.sum_index;
				const groupRow = projectSheet.getRow( sumIndex );

				const sheetSumGroupCell = groupRow.getCell( 'G' );
				sheetSumGroupCell.value = { formula: 'SUBTOTAL(9,H' + ( sumIndex + 1 ) + ':G' + ( sumIndex + item.length ) +')' };
				sheetSumGroupCell.numFmt = '#,##0';
			} );

			// // FOOTER INFO
			const lastRow = lastRowIndex > 8 ? projectSheet.rowCount : 8;

			// Style for empty cell between SUM and VALUE
			// Set style for Group row
			_.range( 1, 5 ).map( key => {
				this._setRightStyle( projectSheet.getCell( 'G' + ( lastRow + key ) ) );
			});

			// Total
			const totalRowIndex = lastRow + 1;
			const totalRow = projectSheet.getRow( totalRowIndex );

			projectSheet.mergeCells( 'A' + totalRowIndex + ':F' + totalRowIndex );
			const totalCell = totalRow.getCell( 'A' );
			totalCell.value = 'Total';
			this._setRightStyle( totalCell );

			const totalMoneyCell = totalRow.getCell( 'G' );
			totalMoneyCell.value = { formula: 'SUBTOTAL(9,G8:G' + lastRow +')' };
			totalMoneyCell.numFmt = '#,##0';
			this._setRightStyle( totalMoneyCell );

			deferred.resolve( true );
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Get logo
	* @private
	* @param {object} workbook
	* @return {void}
	*/
	_getLogo( workbook ) {
		const deferred = Q.defer();

		try {
			const brandLogo = this.setting ? _.findWhere( this.setting, { key: 'BRANCH_LOGO' } ) : null;

			if ( !brandLogo || !brandLogo.value ) {
				deferred.resolve({
					status	: false,
					message	: 'NO_LOGO',
				});
				return deferred.promise;
			}

			const logoData = sizeOf( brandLogo.value );
			const logoId = workbook.addImage({
				filename	: brandLogo.value,
				extension	: logoData.type || 'png',
			});

			deferred.resolve({
				status	: true,
				message	: 'GET_LOGO_SUCCESS',
				data	: { id: logoId, ext: logoData },
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Add logo to sheet
	* @private
	* @param {object} worksheet
	* @param {any} logo
	* @return {void}
	*/
	_addLogo( worksheet, logo ) {
		if ( !logo || !logo.status ) return;

		const logoData = logo.data;

		worksheet.mergeCells( 'A1:G1' );
		worksheet.getRow( '1' ).height = logoData.ext.height;
		worksheet.addImage(
			logoData.id,
			{
				tl	: { col: 1, row: .5 },
				ext	: logoData.ext,
			}
		);
	}

	/**
	* Get image
	* @private
	* @param {object} worksheet
	* @param {any} item
	* @return {void}
	*/
	_getImage( worksheet, item ) {
		const deferred = Q.defer();

		try {
			if ( !item || !item.image ) {
				deferred.resolve({
					status	: false,
					message	: 'NO_IMAGE',
				});
				return deferred.promise;
			}

			const image = item.image;
			const imageData = sizeOf( image );
			const imageId = worksheet.addImage({
				filename	: image,
				extension	: imageData.type || 'png',
			});

			deferred.resolve({
				status		: true,
				message		: 'GET_IMAGE_SUCCESS',
				line_item_id: item.id,
				data		: { id: imageId, ext: imageData },
			});
		} catch ( error ) {
			deferred.reject( error );
			new Logger().write( 'error', error, this.channelId );
		}

		return deferred.promise;
	}

	/**
	* Add logo to sheet
	* @private
	* @param {object} worksheet
	* @param {string} image
	* @param {number} row
	* @return {void}
	*/
	_addImage( worksheet, image, row ) {
		if ( !image || !image.status ) return;

		const imageData = image.data;

		worksheet.getRow( row ).height = imageData.ext.height * 72 / 96;
		worksheet.addImage(
			imageData.id,
			{
				tl	: { col: 8.1, row: row - .5 },
				ext	: imageData.ext,
			}
		);
	}

	/**
	* Add project info
	* @private
	* @param {object} worksheet
	* @param {object} project
	* @return {void}
	*/
	_addProjectInfo( worksheet, project ) {
		const contractSigner = _.findWhere( this.setting, { key: 'CONTRACT_SIGNER_FULL_NAME' } );
		const contractSignerTitle = _.findWhere( this.setting, { key: 'CONTRACT_SIGNER_TITLE' } );

		let currRowIndex = worksheet.rowCount;

		currRowIndex++;

		worksheet.mergeCells( 'B' + currRowIndex + ':C' + currRowIndex );
		worksheet.mergeCells( 'D' + currRowIndex + ':E' + currRowIndex );

		const currRow = worksheet.getRow( currRowIndex );

		currRow.getCell( 'B' ).value = 'Project: ' + ( project.name || '' )
			+ '\nClient: ' + ( ( project.client ? project.client.short_name : project.client_name ) || '' )
			+ '\nContract Signer: '
				+ ( contractSigner && contractSigner.value ? contractSigner.value : '' )
				+ ( contractSignerTitle && contractSignerTitle.value ? ' (' + contractSignerTitle.value + ')' : '' );

		currRow.getCell( 'D' ).value = 'Exchange rate: ' + project.exchange_rate.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
			+ '\nDuration: ' + moment( project.start ).format( 'D/M/Y' )
				+ ' - '
				+ moment( project.end ).format( 'D/M/Y' );

		currRow.height = 35;
		currRow.font = { bold: true };
		currRow.alignment = {
			vertical: 'top',
			wrapText: true,
		};

		worksheet.getColumn( 'B' ).width = 40;
		worksheet.getColumn( 'C' ).width = 40;
		worksheet.getColumn( 'D' ).width = 20;
		worksheet.getColumn( 'E' ).width = 40;
		worksheet.getColumn( 'F' ).width = 20;
	}

	/**
	* Add project sheet info
	* @private
	* @param {object} projectSheet
	* @param {object} project
	* @return {void}
	*/
	_addProjectSheetInfo( projectSheet, project ) {
		let currRowIndex = projectSheet.rowCount;

		currRowIndex++;

		projectSheet.mergeCells( 'B' + currRowIndex + ':C' + currRowIndex );
		projectSheet.mergeCells( 'D' + currRowIndex + ':E' + currRowIndex );

		const currRow = projectSheet.getRow( currRowIndex );

		currRow.getCell( 'B' ).value = 'Project: ' + ( project.name || '' )
			+ '\nClient: ' + ( ( project.client ? project.client.short_name : project.client_name ) || '' );

		currRow.getCell( 'D' ).value = 'Exchange rate: ' + project.exchange_rate.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
			+ '\nDuration: ' + moment( project.start ).format( 'D/M/Y' )
				+ ' - '
				+ moment( project.end ).format( 'D/M/Y' );

		currRow.height = 25;
		currRow.font = { bold: true };
		currRow.alignment = {
			vertical: 'top',
			wrapText: true,
		};

		projectSheet.getColumn( 'B' ).width = 40;
		projectSheet.getColumn( 'C' ).width = 40;
		projectSheet.getColumn( 'D' ).width = 20;
		projectSheet.getColumn( 'E' ).width = 20;
		projectSheet.getColumn( 'F' ).width = 20;
		projectSheet.getColumn( 'G' ).width = 20;
		projectSheet.getColumn( 'H' ).width = 40;
	}

	/**
	* Calculate total cost and WHT
	* @private
	* @param {array} projetLineItems
	* @return {void}
	*/
	_calcualteTotalCost( projetLineItems ) {
		let totalCost = 0;

		_.each( projetLineItems, item => {
			totalCost += item.amount * item.price;
		} );

		return totalCost;
	}

	/**
	* Set cell with center style
	* @private
	* @param {object} cell
	* @return {void}
	*/
	_setCenterStyle( cell ) {
		const fontOptions = { bold: true };
		const alignmentOptions = { horizontal: 'center' };
		const primaryColor = _.findWhere( this.setting, { key: 'BRANCH_PRIMARY_COLOR' } );
		const secondaryColor = _.findWhere( this.setting, { key: 'BRANCH_SECONDARY_COLOR' } );

		if ( primaryColor ) {
			cell.fill = {
				type	: 'pattern',
				pattern	: 'solid',
				fgColor: {
					argb : primaryColor
					.value
					.replace( '#', '' )
					.toString()
					.padStart( 2, '0' ),
				},
			};
		}

		if ( secondaryColor ) {
			fontOptions.color = {
				argb: secondaryColor
				.value
				.replace( '#', '' )
				.toString()
				.padStart( 2, '0' ),
			};
		}

		cell.font = _.clone( fontOptions );
		cell.alignment = _.clone( alignmentOptions );
	}

	/**
	* Set cell with right style
	* @private
	* @param {object} cell
	* @return {void}
	*/
	_setRightStyle( cell ) {
		const fontOptions = { bold: true };
		const alignmentOptions = { horizontal: 'right' };
		const primaryColor = _.findWhere( this.setting, { key: 'BRANCH_PRIMARY_COLOR' } );
		const secondaryColor = _.findWhere( this.setting, { key: 'BRANCH_SECONDARY_COLOR' } );

		if ( primaryColor ) {
			cell.fill = {
				type	: 'pattern',
				pattern	: 'solid',
				fgColor: {
					argb : primaryColor
					.value
					.replace( '#', '' )
					.toString()
					.padStart( 2, '0' ),
				},
			};
		}

		if ( secondaryColor ) {
			fontOptions.color = {
				argb: secondaryColor
				.value
				.replace( '#', '' )
				.toString()
				.padStart( 2, '0' ),
			};
		}

		cell.font = _.clone( fontOptions );
		cell.alignment = _.clone( alignmentOptions );
	}

}

module.exports = ProjectExportHandler;
