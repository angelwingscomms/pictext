import { type RequestHandler } from '@sveltejs/kit';
import { join } from 'path';
import { promises as fsPromises } from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { G } from '$env/static/private';
import { v4 as uuidv4 } from 'uuid';

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
  let waitTime = 2700;
  const t = url.searchParams.get('t');
  if (t) {
    const parsedT = parseInt(t);
    if (parsedT) waitTime = parsedT * 1000
  }

	console.log('r', 'route')
	const folderName = uuidv4();
	console.log('e', folderName)

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
				await new Promise((resolve) => setTimeout(resolve, waitTime)); // Use waitTime
			}
		}

		await fsPromises.rm(folderPath, { recursive: true }); // Delete the folder after processing

		return new Response(allText);
	} catch (error) {
		console.error('Error processing images:', error);
		try {
			await fsPromises.rm(folderPath, { recursive: true, force: true }); //Attempt to delete folder on error
		} catch (rmError) {
			console.error('Error deleting folder:', rmError);
		}
		return new Response('Error processing images', { status: 500 });
	}
};