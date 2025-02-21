import { type RequestHandler } from '@sveltejs/kit';
import { join } from 'path';
import { promises as fsPromises } from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { G } from '$env/static/private';

const genAI = new GoogleGenerativeAI(G);
const fileManager = new GoogleAIFileManager(G);

/**
	* Uploads the given file to Gemini.
	*
	* See https://ai.google.dev/gemini-api/docs/prompting_with_media
	*/
async function uploadToGemini(path: string, mimeType: string) {
	const uploadResult = await fileManager.uploadFile(path, {
		mimeType,
		displayName: path
	});
	const file = uploadResult.file;
	console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
	return file;
}

const model = genAI.getGenerativeModel({
	model: 'gemini-2.0-flash-exp'
});

const generationConfig = {
	temperature: 1,
	topP: 0.95,
	topK: 64,
	maxOutputTokens: 8192,
	responseMimeType: 'text/plain'
};

async function run(filePath: string) {
	const file = await uploadToGemini(filePath, 'image/jpeg');

	const chatSession = model.startChat({
		generationConfig,
		history: [
			{
				role: 'user',
				parts: [
					{
						fileData: {
							mimeType: file.mimeType,
							fileUri: file.uri
						}
					},
					{ text: 'write out all the text in this image' }
				]
			}
		]
	});

	const result = await chatSession.sendMessage('INSERT_INPUT_HERE');
	return result.response.text();
}

export const POST: RequestHandler = async ({ request, url }) => {
  console.log('r', 'route')
	const folderName = url.searchParams.get('f');
	console.log('e', folderName)
	if (!folderName) {
		return new Response('No folder name provided', { status: 400 });
	}

	const folderPath = `./images/${folderName}`;

  console.log('f', folderPath);
	try {
		await fsPromises.mkdir(folderPath, { recursive: true }); // Create directory if it doesn't exist

		const formData = await request.formData();
		const imageFiles = Array.from(formData.entries()).filter(([, value]) => value instanceof File);

		console.log('i', imageFiles)
		for (const [, value] of imageFiles) {
			const file = value as File;
			const filePath = join(folderPath, file.name);
			await fsPromises.writeFile(filePath, Buffer.from(await file.arrayBuffer()));
		}

		const files = await fsPromises.readdir(folderPath);
		let allText = '';

		for (const file of files) {
			if (file.endsWith('.jpeg') || file.endsWith('.jpg') || file.endsWith('.png')) {
				const filePath = join(folderPath, file);
				console.log('run');
				const text = await run(filePath);
				console.log('run');
				allText += `\n\n\n${text}`;
				await new Promise((resolve) => setTimeout(resolve, 9000)); // Wait 9 seconds
			}
		}

		return new Response(allText);
	} catch (error) {
		console.error('Error processing images:', error);
		return new Response('Error processing images', { status: 500 });
	}
};
