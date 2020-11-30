const Sequelize = require( 'sequelize' );
const Q = require( 'q' );

const BaseModel = require( '@models/base' );
const VendorCategory = require( './vendor_category' );

module.exports = async channelId => {
	const deferred = Q.defer();

	try {
		let VendorModel = BaseModel.get( channelId, 'vendor' );

		if ( VendorModel ) {
			deferred.resolve( VendorModel );
			return deferred.promise;
		}

		const VendorCategoryModel = await VendorCategory( channelId );

		VendorModel = await BaseModel.define(
			channelId,
			'vendor',
			{
				vendor_category_id: {
					type	: Sequelize.INTEGER,
					onUpdate: 'CASCADE',
					onDelete: 'SET NULL',
					references: {
						model	: VendorCategoryModel,
						key		: 'id',
					},
				},
				name: {
					type		: Sequelize.STRING,
					allowNull	: false,
					validate	: { len: [ 1, 255 ] },
				},
				short_name: {
					type		: Sequelize.STRING,
					allowNull	: false,
					validate	: { len: [ 1, 255 ] },
				},
				phone: {
					type	: Sequelize.STRING,
					validate: { len: [ 0, 255 ] },
				},
				tax: {
					type	: Sequelize.STRING,
					validate: { len: [ 0, 255 ] },
				},
				address: {
					type	: Sequelize.STRING,
					validate: { len: [ 0, 255 ] },
				},
				bank_name: {
					type	: Sequelize.STRING,
					validate: { len: [ 0, 255 ] },
				},
				bank_province: {
					type	: Sequelize.STRING,
					validate: { len: [ 0, 255 ] },
				},
				bank_branch: {
					type	: Sequelize.STRING,
					validate: { len: [ 0, 255 ] },
				},
				bank_account_number: {
					type	: Sequelize.STRING,
					validate: { len: [ 0, 255 ] },
				},
				payment_term: {
					type		: Sequelize.INTEGER.UNSIGNED,
					allowNull	: false,
					defaultValue: 0,
					validate	: { min: 0 },
				},
				is_disabled: {
					type		: Sequelize.BOOLEAN,
					allowNull	: false,
					defaultValue: false,
				},
				description	: Sequelize.TEXT( 'long' ),
				contact_list: Sequelize.TEXT( 'long' ),
			},
			{
				paranoid: true,
				setterMethods: {
					contact_list( value ) {
						this.setDataValue( 'contact_list', JSON.stringify( value ) );
					},
				},
				getterMethods: {
					contact_list() {
						const contactList = this.getDataValue( 'contact_list' );
						return contactList ? JSON.parse( contactList ) : undefined;
					},
				},
			}
		);

		try {
			VendorCategoryModel.hasMany( VendorModel, { foreignKey: 'vendor_category_id' } );

			VendorModel.belongsTo( VendorCategoryModel, { foreignKey: 'vendor_category_id' } );
		} catch {}

		// Cache model is associated
		BaseModel.set( channelId, 'vendor', VendorModel );

		deferred.resolve( VendorModel );
	} catch ( error ) {
		deferred.reject( error );
	}

	return deferred.promise;
};
