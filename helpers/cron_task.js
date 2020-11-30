const _ = require( 'underscore' );
const CronJob = require( 'cron' ).CronJob;
const Sequelize = require( 'sequelize' );
const fs = require( 'fs' );
const moment = require( 'moment-timezone' );

const Factory = require( './factory' );
const Logger = require( './logger' );
const CronTaskRepository = require( '@models/system/cron_task_repository' );

const SERVER = Factory.getConfig( 'server' );
const Op = Sequelize.Op;

class CronTask {

	/**
	* Execute destroy cron task is expired tasks
	* @static
	* @return {void}
	*/
	static execDestroyCronTaskIsExpiredTask() {
		new CronJob( '00 00 00 * * *', () => {
			new CronTaskRepository().deleteCronTasks({
				trigger_date: { [ Op.lt ]: moment().format() },
			});
		}, null, true, SERVER.TIMEZONE );
	}

	/**
	* Execute delete temp file tasks
	* @static
	* @return {void}
	*/
	static execDeleteTempFileTask() {
		new CronJob( '00 00 * * * *', async () => {
			try {
				const cronTaskRepository = new CronTaskRepository();
				// Trigger all cron tasks
				const cronTasks = await cronTaskRepository
				.getCronTasks(
					'deleteTempFile',
					moment().minute( 0 ).second( 0 ).format()
				);

				_.each( cronTasks, cronTask => {
					const params = JSON.parse( cronTask.params || '{}' );

					// Execute
					fs.unlink( params.file_path, () => {} );

					// Destroy
					cronTaskRepository.deleteCronTasks( { id: cronTask.id } );
				} );
			} catch ( error ) {
				new Logger().write( 'error', error );
			}
		}, null, true, SERVER.TIMEZONE );
	}

}

module.exports = CronTask;
