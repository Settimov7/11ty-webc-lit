import 'dotenv/config';
import pluginWebc from "@11ty/eleventy-plugin-webc";
import browserslist from 'browserslist';
import browserslistToEsbuild from 'browserslist-to-esbuild';
import esbuild from 'esbuild';
import { litCssPlugin } from 'esbuild-plugin-lit-css';
import htmlMinifier from 'html-minifier-terser';
import { transform, browserslistToTargets } from 'lightningcss';
import { parse } from 'node-html-parser';

const isProduction = process.env.NODE_ENV === 'production';

const OUTPUT_FOLDER = 'dist';

const LIGHTNINGCSS_CONFIG = {
	targets: browserslistToTargets(browserslist()),
	minify: isProduction,
	sourceMap: !isProduction,
}

const ESBUILD_CONFIG = {
	format: 'esm',
	target: browserslistToEsbuild(),
	minify: isProduction,
	treeShaking: isProduction,
	sourcemap: !isProduction,
	legalComments: 'none',
}

const ESBUILD_LIT_CONFIG = {
	...ESBUILD_CONFIG,
	outdir: `${OUTPUT_FOLDER}/bundle`,
	entryNames: '[dir]/[name]-[hash]',
	bundle: true,
	splitting: true,
	metafile: true,
	plugins: [
		litCssPlugin({
			transform: function (css) {
				const { code } = transform({
					...LIGHTNINGCSS_CONFIG,
					code: Buffer.from(css),
				});

				return code;
			},
		}),
	],
};

export default function(eleventyConfig) {
    eleventyConfig.addPlugin(pluginWebc, {
		components: [
			"./src/shared/ui-kit/**/*.webc",
			"npm:@11ty/is-land/*.webc",
		],
		hoist: true,
		bundlePluginOptions: {
			transforms: [
				async function optimizeCSS(content) {
					if (this.type !== "css") {
						return content;
					}

					const { code } = transform({
						...LIGHTNINGCSS_CONFIG,
						code: Buffer.from(content),
					});

					return code;
				},
				async function optimizeJS(content) {
					if (this.type !== "js") {
						return content;
					}

					const { code } = await esbuild.transform(content, ESBUILD_CONFIG);

					return code;
				},
			],
		},
	});

	eleventyConfig.addTransform("htmlmin", async function (content) {
		if (!this.page.outputPath?.endsWith(".html")) {
			return content;
		}

		const root = parse(content);

		const scriptNodes = root.querySelectorAll('is-land script');

		const { metafile } = await esbuild.build({
			...ESBUILD_LIT_CONFIG,
			entryPoints: scriptNodes.map((node) => node.getAttribute('src').slice(1)),
		});

		const outputEntries = Object.entries(metafile.outputs);

		scriptNodes.forEach((node) => {
			const entry = outputEntries.find(([, { entryPoint }]) => entryPoint === node.getAttribute('src').slice(1));

			if (!entry) {
				return;
			}

			node.setAttribute('src', entry.at(0).slice(OUTPUT_FOLDER.length));
		});

		return htmlMinifier.minify(root.toString(), {
			collapseWhitespace: true,
			removeComments: true,
			useShortDoctype: true,
			removeRedundantAttributes: true,
			removeEmptyAttributes: true,
		});
	});

	return {
		dir: {
			input: "src/pages",
			includes: "../shared/includes/layouts",
			data: "../data",
			output: OUTPUT_FOLDER,
		},
	}
};
