import type {IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription,} from 'n8n-workflow';
import {NodeConnectionType, NodeOperationError} from 'n8n-workflow';
import {load} from 'cheerio';


export class HtmlParts implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Extract from HTML',
		icon: 'file:htmlparts.svg',
		name: 'htmlParts',
		group: ['transform'],
		version: 1,
		description: 'Extract Structure from HTML',
		defaults: {
			name: 'HTML parts',
		},
		inputs: ['main'] as NodeConnectionType.Main[],
		outputs: ['main'] as NodeConnectionType.Main[],
		properties: [
			{
				displayName: 'Raw HTML',
				name: 'htmlString',
				type: 'string',
				default: '',
				placeholder: '<html><head></head><body>hello world</body></html>',
				description: 'The raw HTML string to extract structure from',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		let item: INodeExecutionData;
		let htmlString: string;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				item = items[itemIndex];

				// Get the value of the parameter "htmlString"
				htmlString = this.getNodeParameter('htmlString', itemIndex, '') as string;

				// Load the HTML string into Cheerio
				const $ = load(htmlString);
				let mainContent = $('main').html() || $('article').html() || $('body').html();

				if (!mainContent) {
					mainContent = '';
				}

				let textContent = $(mainContent).find('style').remove().end().find('script').remove().end().text();
				// remove superfluous newlines x3 and tabs
				mainContent = mainContent?.replace(/(\r\n|\n \n|\r|\t)/gm, '');

				// $('script').remove();
				$('style').remove();


				let objects = {
					title: $('title').text(),
					description: $('meta[name="description"]').attr('content'),
					keywords: $('meta[name="keywords"]').attr('content'),
					canonical: $('link[rel="canonical"]').attr('href'),
					ogTitle: $('meta[property="og:title"]').attr('content'),
					ogDescription: $('meta[property="og:description"]').attr('content'),
					ogImage: $('meta[property="og:image"]').attr('content'),
					ogUrl: $('meta[property="og:url"]').attr('content'),
					ogSiteName: $('meta[property="og:site_name"]').attr('content'),
					ogType: $('meta[property="og:type"]').attr('content'),
					ogLocale: $('meta[property="og:locale"]').attr('content'),
					ogPublishedTime: $('meta[property="article:published_time"]').attr('content'),
					ogModifiedTime: $('meta[property="article:modified_time"]').attr('content'),
					ogAuthor: $('meta[property="article:author"]').attr('content'),
					ogSection: $('meta[property="article:section"]').attr('content'),
					ogTag: $('meta[property="article:tag"]').attr('content'),
					meta: $('meta').map((_, el) => $(el).attr('content')).get(),
					links: $('link').map((_, el) => $(el).attr('href')).get(),
					images: $('img').map((_, el) => $(el).attr('src')).get(),
					videos: $('video').map((_, el) => $(el).attr('src')).get(),
					iframes: $('iframe').map((_, el) => $(el).attr('src')).get(),
					headings: $('h1, h2, h3, h4, h5, h6').map((_, el) => ({level: el.tagName.toLowerCase(), text: $(el).text().trim()})).get(),
					text: textContent,
					wordCount: textContent.split(/\s+/).length,
					characterCount: textContent.length,
					mainContent: mainContent
				};

				item.json.data = objects;
			} catch (error) {
				// This node should never fail, but we want to showcase how
				// to handle errors.
				if (this.continueOnFail()) {
					items.push({json: this.getInputData(itemIndex)[0].json, error, pairedItem: itemIndex});
				} else {
					// Adding `itemIndex` allows other workflows to handle this error
					if (error.context) {
						// If the error thrown already contains the context property,
						// only append the itemIndex
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				}
			}
		}

		return [items];
	}
}
