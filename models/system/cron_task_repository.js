const Models = require( 'nodejs-core/multi_db/models' );

class CronTaskRepository extends Models.CronTaskRepository {}

module.exports = CronTaskRepository;
