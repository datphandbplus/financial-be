const Vendor = require( './vendor' );
const Repository = require( '@models/repository' );

class VendorRepository extends Repository {

	/**
	* @constructor
	* @param {string} channelId
	*/
	constructor( channelId ) {
		super( Vendor( channelId ) );
	}

}

module.exports = VendorRepository;
