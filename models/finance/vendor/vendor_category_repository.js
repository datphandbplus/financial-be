const VendorCategory = require( './vendor_category' );
const Repository = require( '@models/repository' );

class VendorCategoryRepository extends Repository {

	/**
	* @constructor
	* @param {string} channelId
	*/
	constructor( channelId ) {
		super( VendorCategory( channelId ) );
	}

}

module.exports = VendorCategoryRepository;
