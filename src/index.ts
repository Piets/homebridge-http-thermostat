import axios from 'axios';
import {
	AccessoryConfig,
	AccessoryPlugin,
	API,
	CharacteristicEventTypes,
	CharacteristicGetCallback,
	CharacteristicSetCallback,
	CharacteristicValue,
	HAP,
	Logging,
	Service,
} from 'homebridge';

let hap: HAP;

export = (api: API) => {
	hap = api.hap;
	api.registerAccessory('http-thermostat', HTTPThermostat);
};

class HTTPThermostat implements AccessoryPlugin {
	private readonly log: Logging;
	private readonly name: string;
	private readonly ip: string;

	private readonly thermostatService: Service;
	private readonly informationService: Service;

	private temperature = 21.5;
	private display_units = hap.Characteristic.TemperatureDisplayUnits.CELSIUS;

	constructor(log: Logging, config: AccessoryConfig, _api: API) {
		this.log = log;
		this.name = config.name;
		this.ip = config.ip;

		// Configure Thermostat Service
		// TargetTemperature
		this.thermostatService = new hap.Service.Thermostat(this.name);
		this.thermostatService
			.getCharacteristic(hap.Characteristic.TargetTemperature)
			.setProps({
				minValue: 5,
				maxValue: 25,
				minStep: 0.5,
			})
			.on(CharacteristicEventTypes.GET, this.getTemperature.bind(this))
			.on(CharacteristicEventTypes.SET, this.setTemperature.bind(this));

		// Current Temperature
		this.thermostatService
			.getCharacteristic(hap.Characteristic.CurrentTemperature)
			.on(CharacteristicEventTypes.GET, this.getTemperature.bind(this));

		// Target Heating Cooling
		this.thermostatService
			.getCharacteristic(hap.Characteristic.TargetHeatingCoolingState)
			.setProps({
				minValue: 1,
				maxValue: 1,
				validValues: [
					hap.Characteristic.TargetHeatingCoolingState.HEAT,
				],
			})
			.on(CharacteristicEventTypes.GET, (callback) =>
				callback(
					null,
					hap.Characteristic.TargetHeatingCoolingState.HEAT
				)
			)
			.on(CharacteristicEventTypes.SET, (_value, callback) => callback());

		// Current Heating Cooling
		this.thermostatService
			.getCharacteristic(hap.Characteristic.CurrentHeatingCoolingState)
			.on(CharacteristicEventTypes.GET, (callback) =>
				callback(
					null,
					hap.Characteristic.TargetHeatingCoolingState.HEAT
				)
			);

		// Temperature Display Units
		this.thermostatService
			.getCharacteristic(hap.Characteristic.TemperatureDisplayUnits)
			.on(CharacteristicEventTypes.GET, this.getDisplayUnits.bind(this))
			.on(CharacteristicEventTypes.SET, this.setDisplayUnits.bind(this));

		// Configure Information Service
		this.informationService = new hap.Service.AccessoryInformation()
			.setCharacteristic(hap.Characteristic.Manufacturer, 'Piets')
			.setCharacteristic(hap.Characteristic.Model, 'HTTP-Thermostat')
			.setCharacteristic(hap.Characteristic.SerialNumber, this.ip);

		log.info('Thermostat finished initializing!');
	}

	getServices(): Service[] {
		return [this.informationService, this.thermostatService];
	}

	// Get Current Target Temperature
	private async getTemperature(
		callback: CharacteristicGetCallback
	): Promise<void> {
		// Immediatly respond with potentially stale value
		const old_temperature = this.temperature;
		callback(null, this.temperature);

		try {
			const json = await axios.get(`http://${this.ip}/`);
			if (json && json.data.temperature) {
				this.temperature = json.data.temperature;
				this.log.debug(
					`updated cached temperature: ${this.temperature}`
				);
			}
		} catch (e) {
			this.log.error(`${e}`);
		} finally {
			// Update Characteristics
			if (old_temperature !== this.temperature) {
				this.thermostatService
					.getCharacteristic(hap.Characteristic.TargetTemperature)
					.updateValue(this.temperature);
				this.thermostatService
					.getCharacteristic(hap.Characteristic.CurrentTemperature)
					.updateValue(this.temperature);
				this.log.debug(
					`updating characteristic value with cached temperature: ${this.temperature}`
				);
			}
		}
	}

	// Set Target Temperature
	private async setTemperature(
		value: CharacteristicValue,
		callback: CharacteristicSetCallback
	): Promise<void> {
		try {
			this.temperature = value as number;

			await axios.post(`http://${this.ip}/`, {
				temperature: this.temperature,
			});

			this.thermostatService
				.getCharacteristic(hap.Characteristic.TargetTemperature)
				.updateValue(this.temperature);
			this.thermostatService
				.getCharacteristic(hap.Characteristic.CurrentTemperature)
				.updateValue(this.temperature);

			this.log.debug(`Set Temperature to ${this.temperature}`);
		} catch (e) {
			this.log.error(`${e}`);
		} finally {
			callback();
		}
	}

	// Get Display Units
	private getDisplayUnits(callback: CharacteristicGetCallback): void {
		this.log.debug(`Responding with display units: ${this.display_units}`);
		callback(null, this.display_units);
	}

	// Set Display Units
	private setDisplayUnits(
		value: CharacteristicValue,
		callback: CharacteristicSetCallback
	): void {
		this.display_units = value as number;
		this.log.debug(`Set display units: ${this.display_units}`);
		callback();
	}
}
