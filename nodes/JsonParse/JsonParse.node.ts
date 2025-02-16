import type {IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription,} from 'n8n-workflow';
import {NodeConnectionType, NodeOperationError} from 'n8n-workflow';

export class JsonParse implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Parse JSON',
		icon: 'file:jsonparse.svg',
		name: 'jsonParse',
		group: ['transform'],
		version: 1,
		description: 'Parse JSON object from a JSON string',
		defaults: {
			name: 'Parse JSON',
		},
		inputs: ['main'] as NodeConnectionType.Main[],
		outputs: ['main'] as NodeConnectionType.Main[],
		properties: [
			{
				displayName: 'JSON String',
				name: 'jsonString',
				type: 'string',
				default: '',
				placeholder: '```json\n{\n\t"key": "value"\n}\n```',
				description: 'The JSON string to parse. Can be clean JSON or kinda dirty JSON, but it must be valid JSON.',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		let item: INodeExecutionData;
		let jsonString: string;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				item = items[itemIndex];

				jsonString = this.getNodeParameter('jsonString', itemIndex, '') as string;

				let jsonObject = {};

				let jsonCleaned = jsonString
					.replace('```json', '')
					.replace('```', '')
					.replace('\n', '')
					.trim();

				try {
					jsonObject = JSON.parse(jsonString);
				} catch (error) {
					// If the JSON is not valid we try to clean it up and parse it again
					jsonObject = JSON.parse(jsonCleaned);
				}

				item.json.jsonObject = jsonObject;
			} catch (error) {
				if (this.continueOnFail()) {
					items.push({json: this.getInputData(itemIndex)[0].json, error, pairedItem: itemIndex});
				} else {
					if (error.context) {
						throw new NodeOperationError(this.getNode(), error.message, error.context);
					}
					throw new NodeOperationError(this.getNode(), error.message);
				}
			}
		}

		return this.prepareOutputData(items);
	}
}
