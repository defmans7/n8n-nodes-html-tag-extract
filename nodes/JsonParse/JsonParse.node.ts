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
				let messages = [];

				// First attempt: Parse original string
				try {
					messages.push('Trying to parse JSON string as is');
					jsonObject = JSON.parse(jsonString);
					messages.push('Successfully parsed JSON string as is');
				} catch (e) {
					messages.push(`Failed to parse JSON string as is: ${e.message}`);

					// Second attempt: Clean and parse
					try {
						// More aggressive cleaning
						const jsonCleaned = jsonString
							.replace(/```json|``` json|```/g, '')
							.replace(/ \\n {2}"/g, '"')
							.replace(/ \\n "/g, '"')
							.replace(/" \\n/g, '"')
							.replace(/"\s*\\n\s*([{}[\],:])/g, '"$1')
							.replace(/\n/g, ' ')
							.replace(/\r/g, '')
							.replace(/\t/g, ' ')
							.trim();

						messages.push('Trying to parse cleaned JSON string');
						jsonObject = JSON.parse(jsonCleaned);
						messages.push('Successfully parsed cleaned JSON string');
					} catch (e2) {
						messages.push(`Failed to parse cleaned JSON string: ${e2.message}`);

						// Third attempt: Extract and parse with more robust extraction
						try {
							messages.push('Trying to extract JSON object manually v2');
							const text = jsonString
								.replace(/```json|``` json|```/g, '')
								.replace(/ \\n {2}"/g, '"')
								.replace(/ \\n "/g, '"')
								.replace(/" \\n/g, '"')
								.replace(/"\s*\\n\s*([{}[\],:])/g, '"$1')
								.replace(/\n/g, ' ')
								.replace(/\r/g, '')
								.replace(/\t/g, ' ');

							// Find the outermost JSON structure
							let jsonStart = text.indexOf('{');
							let jsonEnd = -1;

							if (jsonStart !== -1) {
								let openBraces = 0;
								for (let i = jsonStart; i < text.length; i++) {
									if (text[i] === '{') openBraces++;
									else if (text[i] === '}') {
										openBraces--;
										if (openBraces === 0) {
											jsonEnd = i;
											break;
										}
									}
								}

								if (jsonEnd > jsonStart) {
									const extractedJson = text.substring(jsonStart, jsonEnd + 1);
									messages.push('Extracted potential JSON string');

									try {
										jsonObject = JSON.parse(extractedJson);
										messages.push('Successfully parsed extracted JSON');
									} catch (innerErr) {
										messages.push(`Extracted JSON is still invalid: ${innerErr.message}`);

										// Fourth attempt: Try to fix common issues in the extracted JSON
										const fixedJson = extractedJson
											.replace(/ \\n {2}"/g, '"')
											.replace(/ \\n "/g, '"')
											.replace(/" \\n/g, '"')
											.replace(/"\s*\\n\s*([{}[\],:])/g, '"$1')
											.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3') // Add quotes to keys
											.replace(/:\s*'([^']*)'/g, ': "$1"'); // Replace single quotes with double quotes

										try {
											jsonObject = JSON.parse(fixedJson);
											messages.push('Successfully parsed fixed JSON');
										} catch (lastErr) {
											messages.push(`Could not parse JSON after fixes: ${lastErr.message}`);
											messages.push(`Raw extracted content: ${extractedJson}`);
										}
									}
								} else {
									messages.push('Could not find matching closing brace');
								}
							} else {
								messages.push('Could not find opening brace for JSON object');
							}
						} catch (e3) {
							messages.push(`Failed in manual extraction process: ${e3.message}`);
							messages.push(`Raw content: ${jsonString}`);
							messages.push(`Last error: ${e3.message}`);
						}
					}
				}

				// Update the item with parsed data and debugging info
				item.json = {
					...item.json,
					jsonObject,
					parsingSuccessful: Object.keys(jsonObject).length > 0
				};
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
