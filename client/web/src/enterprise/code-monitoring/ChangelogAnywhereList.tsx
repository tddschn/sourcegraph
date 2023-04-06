import React, { useEffect, useState } from 'react'

import { LazyQueryInput } from '@sourcegraph/branded'
import { Client, createClient } from '@sourcegraph/cody-shared/src/chat/client'
import { renderMarkdown } from '@sourcegraph/cody-shared/src/chat/markdown'
import { ChatMessage } from '@sourcegraph/cody-shared/src/chat/transcript/messages'
import { Message } from '@sourcegraph/cody-shared/src/sourcegraph-api'
import { ErrorLike, isErrorLike } from '@sourcegraph/common'
import { useLazyQuery, gql } from '@sourcegraph/http-client'
import { QueryState } from '@sourcegraph/shared/src/search'
import { Container, Link, H2, H3, Button, Markdown, LoadingSpinner, ErrorAlert } from '@sourcegraph/wildcard'

import { AuthenticatedUser } from '../../auth'
import {
    SearchCommitSearchResult,
    SearchForChangesResult,
    SearchForChangesVariables,
    SearchPatternType,
} from '../../graphql-operations'

import { CodeMonitoringPageProps } from './CodeMonitoringPage'

interface ChangelogAnywhereListProps
    extends Required<Pick<CodeMonitoringPageProps, 'fetchUserCodeMonitors' | 'toggleCodeMonitorEnabled'>> {
    authenticatedUser: AuthenticatedUser | null
}

const ChangelogEmptyList: React.FunctionComponent = () => (
    <div className="text-center">
        <H2 className="text-muted mb-2">No changelogs have been created.</H2>
    </div>
)

const MOCK_COMMITS_ACTUAL = [
    'bazel: bazel configure (#50320)\n\nBazel configure based on [the Slack\r\nthread](https://sourcegraph.slack.com/archives/C04MYFW01NV/p1680563481187279).\r\n`.d.ts` files have a special config in gazelle: `# gazelle:js_files\r\nglobals.d.ts`, so I renamed recently added `typings.d.ts` to\r\n`globals.d.ts` to keep them consistent across packages.',
    "clean up Cody CSS to increase shareability and improve display in web app (#50279)\n\nNo change to VS Code's UI (except minor fixes, like making filenames not\r\na separate font).\r\n\r\n\r\n![image](https://user-images.githubusercontent.com/1976/229504083-4a80daa1-d379-4913-9c3c-318e8347b0df.png)\r\n\r\n\r\n## Test plan\r\n\r\nn/a",
    'cody: logging PR improvements (#50277)\n\nImplemented my suggestions from the logging PR review.\r\n\r\n## Test plan\r\n\r\n* Run the logging locally.\r\n\r\n## App preview:\r\n\r\n- [Web](https://sg-web-rn-add-cody-recipe-logging.onrender.com/search)\r\n\r\nCheck out the [client app preview\r\ndocumentation](https://docs.sourcegraph.com/dev/how-to/client_pr_previews)\r\nto learn more.\r\n\r\n---------\r\n\r\nCo-authored-by: Nathan Downs <85511556+nathan-downs@users.noreply.github.com>',
    'Add logging to Cody (#50144)\n\n## Test plan\r\n\r\nInstall Cody VS Extension locally and test that events are correctly\r\nfiring to dot com.\r\n<!-- All pull requests REQUIRE a test plan:\r\nhttps://docs.sourcegraph.com/dev/background-information/testing_principles\r\n-->\r\n\r\n## App preview:\r\n\r\n- [Web](https://sg-web-nd-add-cody-recipe-logging.onrender.com/search)\r\n\r\nCheck out the [client app preview\r\ndocumentation](https://docs.sourcegraph.com/dev/how-to/client_pr_previews)\r\nto learn more.\r\n\r\n---------\r\n\r\nCo-authored-by: dadlerj <daniel.neal.adler@gmail.com>\r\nCo-authored-by: Aditya Kalia <32119652+akalia25@users.noreply.github.com>\r\nCo-authored-by: Quinn Slack <quinn@slack.org>',
    "extract Cody UI package, add Cody to web app (#50270)\n\n- The new `client/cody-ui` package (`@sourcegraph/cody-ui`) contains\r\nreusable components for Cody's UI that are shared among all web UIs for\r\nCody.\r\n- The Sourcegraph web app repo sidebar now adds a `Cody` tab (alongside\r\nfiles and symbols) when the `cody-experimental` feature flag is enabled.\r\nThis lets you use Cody in the web app.\r\n- A new demonstration `client/cody-web` package implements a standalone\r\nweb app for Cody.\r\n\r\nNo behavior change is intended to the Cody code.\r\n\r\n## Test plan\r\n\r\nBuild and run the Cody extension locally. Ensure that it still functions\r\nas is. All other changes are experimental and behind a feature flag (in\r\nthe main web app).",
    'Cody: Merge back CI changes (#50231)\n\nA few tweaks to get the CI build working that I pushed directly to\r\n`cody/release` to iterate faster.\r\n\r\nThe next release will require a force-push though!\r\n\r\nCI got further but its still using the old tokens. According to\r\n@burmudar this will take a bit to propagate fully\r\n\r\nI’m considering doing this release locally one last time so we can have\r\nit out right now and we can test the CI script for 0.0.5 when the tokens\r\nare updated cc @novoselrok\r\n\r\n## Test plan\r\n\r\nCI got further\r\n\r\n<img width="814" alt="Screenshot 2023-03-31 at 17 00 02"\r\nsrc="https://user-images.githubusercontent.com/458591/229156848-545940e0-41d2-4fb9-bfa3-6e471e194c5c.png">\r\n\r\n\r\n\r\n\r\n\r\n<!-- All pull requests REQUIRE a test plan:\r\nhttps://docs.sourcegraph.com/dev/background-information/testing_principles\r\n-->\r\n\r\n## App preview:\r\n\r\n- [Web](https://sg-web-ps-cody-fix-ci-num-2.onrender.com/search)\r\n\r\nCheck out the [client app preview\r\ndocumentation](https://docs.sourcegraph.com/dev/how-to/client_pr_previews)\r\nto learn more.',
    'Cody: Download ripgrep on CI (#50227)\n\nFixes this CI issue:\r\n\r\n<img width="1222" alt="Screenshot 2023-03-31 at 14 46 41"\r\nsrc="https://user-images.githubusercontent.com/458591/229124063-8bb252a5-0663-4cf6-9e20-d78865dc5343.png">\r\n\r\n## Test plan\r\n\r\n- We\'ll have to test on CI\r\n\r\n<!-- All pull requests REQUIRE a test plan:\r\nhttps://docs.sourcegraph.com/dev/background-information/testing_principles\r\n-->\r\n\r\n## App preview:\r\n\r\n- [Web](https://sg-web-ps-cody-rg-ci.onrender.com/search)\r\n\r\nCheck out the [client app preview\r\ndocumentation](https://docs.sourcegraph.com/dev/how-to/client_pr_previews)\r\nto learn more.',
    'Cody: Release 0.0.4 (#50220)\n\nBumping the version number for the 0.0.4 release as discussed in\r\n[slack](https://sourcegraph.slack.com/archives/C04MSD3DP5L/p1680253929682909).\r\n\r\nWe\'ll use the automation from #50216 to publish.\r\n\r\n## Test plan\r\n\r\n- Tested the build locally\r\n\r\n\r\n<img width="1524" alt="Screenshot 2023-03-31 at 14 24 42"\r\nsrc="https://user-images.githubusercontent.com/458591/229119253-74a000ae-8597-4190-a51a-0b992aa589f2.png">\r\n\r\n\r\n<!-- All pull requests REQUIRE a test plan:\r\nhttps://docs.sourcegraph.com/dev/background-information/testing_principles\r\n-->\r\n\r\n## App preview:\r\n\r\n- [Web](https://sg-web-ps-cody-release-0-0-4.onrender.com/search)\r\n\r\nCheck out the [client app preview\r\ndocumentation](https://docs.sourcegraph.com/dev/how-to/client_pr_previews)\r\nto learn more.',
    "Cody: Add release automation (#50216)\n\nInspired by out VS Code setup. This may need some trial and error as I\r\nfigure out the exact CI steps so bear with me.\r\n\r\n## Todo\r\n\r\n- Get the release tokens in properly => should work now but we might\r\nneed to update the tokens on CI if they no longer work\r\n- Changelog process? => Decided to skip this for now since we don't have\r\na changelog\r\n\r\n## Test plan\r\n\r\n- We'll test with the 0.0.4 release\r\n\r\n<!-- All pull requests REQUIRE a test plan:\r\nhttps://docs.sourcegraph.com/dev/background-information/testing_principles\r\n-->",
    'Cody: Fix text input styling (#50221)\n\nThis cleans up some borders around the text input. \r\n\r\n## Current UI\r\n\r\n<img width="716" alt="Screenshot 2023-03-31 at 13 10 28"\r\nsrc="https://user-images.githubusercontent.com/458591/229105012-7948ad6f-52e1-4e38-b0ff-cfeaac03208c.png">\r\n\r\n\r\n## Test plan\r\n\r\nTested with various themes\r\n\r\n\r\nhttps://user-images.githubusercontent.com/458591/229104353-8d18312b-92a4-4cc5-8f7b-71c610610bcf.mov\r\n\r\n\r\n\r\n<!-- All pull requests REQUIRE a test plan:\r\nhttps://docs.sourcegraph.com/dev/background-information/testing_principles\r\n-->',
    'cody feature: add button to copy code (#49959)\n\nRE[ feature requested by\r\nuser](https://sourcegraph.slack.com/archives/C04MSD3DP5L/p1679516277669339)\r\nClose https://github.com/sourcegraph/cody/issues/97\r\n\r\n### 1. Add a button to copy code block text to each code block:\r\n\r\n\r\n![image](https://user-images.githubusercontent.com/68532117/228306555-f63526fb-1161-4959-ae7a-d25a39893dc2.png)\r\n\r\n\r\n### Fix HTML tags rendering issue in chat view\r\n\r\nRE: https://github.com/sourcegraph/cody/issues/97\r\n\r\n<table>\r\n<tr>\r\n<td>Before</td>\r\n<td>After</td>\r\n</tr>\r\n<tr>\r\n<td>\r\n<img width="400" alt="image"\r\nsrc="https://user-images.githubusercontent.com/68532117/228063621-ff48d77a-685c-4cff-b0cf-f88cc9a7efe8.png">\r\n<img width="400" alt="image"\r\nsrc="https://user-images.githubusercontent.com/68532117/228063940-0898805a-718e-4430-ae6e-ec04cfaa0860.png">\r\n</td>\r\n<td>\r\n<img width="400" alt="image"\r\nsrc="https://user-images.githubusercontent.com/68532117/228063194-c09e8b38-0a07-4220-9ea7-640c15a5554d.png">\r\n<img width="400" alt="image"\r\nsrc="https://user-images.githubusercontent.com/68532117/228063847-020c6370-2997-4450-a5a6-5a714d402341.png">\r\n</td>\r\n</tr>\r\n</table>\r\n\r\n\r\n## Test plan\r\n\r\n<!-- All pull requests REQUIRE a test plan:\r\nhttps://docs.sourcegraph.com/dev/background-information/testing_principles\r\n-->\r\n\r\nTo test:\r\n1. clone and pull the latest commit from this branch\r\n2. run pnpm install from root\r\n3. Select Launch Cody Extension from the dropdown menu in the RUN AND\r\nDEBUG sidebar in VS Code\r\n4. Type `what does <button>button</button> do in html?` to see HTML\r\nrender issues resolved\r\n5. Type `show me the code to create a button in react` to test copy\r\nbutton in code snippets.\r\n\r\nDemo:\r\n\r\n\r\n![cody-copy-btn](https://user-images.githubusercontent.com/68532117/228307211-2f4fd6ce-ac19-4326-847c-8220d6c91050.gif)\r\n\r\n## App preview:\r\n\r\n- [Web](https://sg-web-bee-cody-copy.onrender.com/search)\r\n\r\nCheck out the [client app preview\r\ndocumentation](https://docs.sourcegraph.com/dev/how-to/client_pr_previews)\r\nto learn more.\r\n\r\n---------\r\n\r\nCo-authored-by: Rok Novosel <rok@sourcegraph.com>',
    "release: Release `cody` to Open VSX Registry (#50047)\n\n## Description\r\n\r\nRelease `Sourcegraph Cody` VS Code Extension to Open VSX Registry.\r\n\r\n**Suggestion**: We should have a common CI pipeline, which could detect\r\nfile changes of both VS Code Extension (Sourcegraph & Sourcegraph Cody)\r\nand release automatically with a new changes. So, that it follows the\r\nconsistent approach across the extensions & also avoid problems like\r\nthis\r\n(https://github.com/sourcegraph/sourcegraph/pull/49408#issuecomment-1486147185)\r\n\r\n## Test plan\r\n\r\nSince, we don't have the CI to prepublish and test, we need to open in\r\nworkspace and execute the following command (this requires OpenVSX PAT\r\nToken):\r\n\r\n```sh\r\nnpm run ovsx:publish\r\n```\r\n\r\n> **Note**: You can use anything like yarn, pnpm to excute this command\r\n\r\n<!-- All pull requests REQUIRE a test plan:\r\nhttps://docs.sourcegraph.com/dev/background-information/testing_principles\r\n-->\r\n\r\n---------\r\n\r\nCo-authored-by: Philipp Spiess <hello@philippspiess.com>",
    "Cody: Fix Windows file path error (#50210)\n\nIt looks like `vscode.Uri.parse()` leads to a malfunctioning Uri object\r\non Windows systems. This PR changes `vscode.Uri.parse()` to\r\n`vscode.Uri.file()`, which converts a file system path to a Uri object.\r\n\r\nMore context\r\n[here](https://sourcegraph.slack.com/archives/C04MSD3DP5L/p1680058607541409)\r\n\r\nWindows Error:\r\n```\r\nlog.ts:404   ERR Unable to resolve filesystem provider with relative file path 'c:\\Users\\user\\.vscode\\extensions\\sourcegraph.cody-ai-0.0.3/dist/index.html'\r\n```\r\n![image\r\n(51)](https://user-images.githubusercontent.com/69164745/228989701-d19ea57b-553d-4015-b236-252fba0c5ece.png)\r\n\r\n## Test plan\r\nTested on Windows 10\r\n\r\n\r\n![cody](https://user-images.githubusercontent.com/69164745/228973540-3c6384de-6173-4487-bdae-671c61ec9ee1.JPG)\r\n\r\n<!-- All pull requests REQUIRE a test plan:\r\nhttps://docs.sourcegraph.com/dev/background-information/testing_principles\r\n-->\r\n\r\n## App preview:\r\n\r\n- [Web](https://sg-web-gabe-cody-relative-path.onrender.com/search)\r\n\r\nCheck out the [client app preview\r\ndocumentation](https://docs.sourcegraph.com/dev/how-to/client_pr_previews)\r\nto learn more.",
    "cody: fix summarize history recipe (#50165)\n\nIf there's no file opened, the summarize history recipe does not work.\r\nUse workspace root instead as the current working directory for git\r\ncommands.\r\n\r\n## Test plan\r\n\r\n* Run Cody in dev mode\r\n* Open a repo in VSCode, but don't open any files\r\n* Run the summarize history command\r\n* You should get a summary of Git history in the chat panel\r\n\r\n## App preview:\r\n\r\n-\r\n[Web](https://sg-web-rn-cody-fix-summarize-history.onrender.com/search)\r\n\r\nCheck out the [client app preview\r\ndocumentation](https://docs.sourcegraph.com/dev/how-to/client_pr_previews)\r\nto learn more.",
    'cody: clickable context (#50104)\n\nWith this change we display files in the context as links. The files are\r\nopened in the active tab.',
    'cody: add repository information to preamble and context about current file (#50101)\n\n## Changes\r\n\r\n* ~Increased the temperature for the default chat parameters from `0.2`\r\nto `0.4`. That should give Cody some more freedom to produce better\r\nsolutions and not get stuck with the `I don\'t know` answers even if it\r\nhas the correct context.~\r\n* Added repository/codebase information to the preamble. Refactored the\r\npreamble to calculate the token usage more accurately.\r\n\r\n\r\n## Before\r\n\r\n<img width="424" alt="Screenshot 2023-03-29 at 12 55 47"\r\nsrc="https://user-images.githubusercontent.com/6417322/228513044-64118fb3-cb8b-45f8-a42c-6e9e0bf0c4dd.png">\r\n\r\n## After\r\n\r\n<img width="421" alt="Screenshot 2023-03-29 at 12 55 52"\r\nsrc="https://user-images.githubusercontent.com/6417322/228513073-1704333a-c4aa-4929-8fe4-4d25d83a0908.png">\r\n\r\n\r\n## Test plan\r\n\r\n<!-- All pull requests REQUIRE a test plan:\r\nhttps://docs.sourcegraph.com/dev/background-information/testing_principles\r\n-->\r\n* Tests should be green.\r\n* Try asking Cody about the current file or repositories it can access.\r\nIt should be able to answer correctly.\r\n\r\n## App preview:\r\n\r\n-\r\n[Web](https://sg-web-rn-cody-add-repo-name-and-editor.onrender.com/search)\r\n\r\nCheck out the [client app preview\r\ndocumentation](https://docs.sourcegraph.com/dev/how-to/client_pr_previews)\r\nto learn more.',
    'cody: skip broken test (#50116)\n\nThe test consistently times out\r\n## Test plan\r\nnone - skipping broken test until it is fixed. Running experiments on\r\nthis branch wb/cody/integration-test\r\n<!-- All pull requests REQUIRE a test plan:\r\nhttps://docs.sourcegraph.com/dev/background-information/testing_principles\r\n-->',
    'use DOMPurify instead of sanitize-html for smaller bundle (#50002)\n\nAlso sanitize HTML more strictly. Previously we allowed SVG and `data:`\r\nURIs in some cases (for some functionality from the legacy Sourcegraph\r\nextension API). This is no longer needed, and getting stricter in HTML\r\nsanitization is generally good.\r\n\r\n\r\n## Test plan\r\n\r\nTest callers of renderMarkdown in UI.\r\n\r\n\r\nCo-authored-by: Juliana Peña <me@julip.co>',
]

const MOCK_COMMITS_PREAMBLE = [
    'RFC: Use native links in references panel (#49709)\n\nThis was motivated by [feedback from this\r\nconversation](https://sourcegraph.slack.com/archives/C04931KQVRC/p1679323575904199)\r\n\r\nThis changes the implementation of the references panel to use a native\r\n`<a>` tag instead of the current `<div role="link>`, removing the\r\nprevious need to [custom handled click\r\nevent](https://github.com/sourcegraph/sourcegraph/blob/d646d9b71f3b91f3e7b79e70386bbd437e99de5f/client/branded/src/search-ui/components/codeLinkNavigation.ts#L123:17)\r\nto make it easier to select text on the link but giving us the following\r\nbenifits:\r\n\r\n- We can now add a native onDoubleClick handler (not possible with the\r\nprevious selection logic as double click was used to select the word).\r\nThis way, we can use a normal double click to open a reference directly\r\nin the blob view instead of having this awkward "click twice with a\r\ndelay" pattern.\r\n- We can now right click => Open link in new tab 🤯 \r\n- cmd+click also now opens the symbol in a new tab which is super handy.\r\n\r\nWhile doing this, I also fixed another issue: We used a different font\r\nto render the references than we used in the blob view. This changes the\r\nfonts to use `var(--code-font-family);` instead.\r\n\r\n## Test plan\r\n\r\n\r\nhttps://user-images.githubusercontent.com/458591/226999869-1b8806ed-7188-4656-ae0b-226936c650a1.mov\r\n\r\n<!-- All pull requests REQUIRE a test plan:\r\nhttps://docs.sourcegraph.com/dev/background-information/testing_principles\r\n-->\r\n\r\n## App preview:\r\n\r\n- [Web](https://sg-web-ps-ref-panel-cmd-click.onrender.com/search)\r\n\r\nCheck out the [client app preview\r\ndocumentation](https://docs.sourcegraph.com/dev/how-to/client_pr_previews)\r\nto learn more.',
    'web: remove codemirror from the initial chunk (#49197)\n\n- Part of https://github.com/sourcegraph/sourcegraph/issues/37845\r\n- The culprit of having `codemirror` in the initial chunk is the\r\n`useCodeIntel` hook that we inject in\r\n`client/web/src/enterprise/EnterpriseWebApp.tsx`. See the screenshot\r\nfrom Statoscope:\r\n<img width="499" alt="Screenshot 2023-03-13 at 20 52 26"\r\nsrc="https://user-images.githubusercontent.com/3846380/224707208-a4c1dedd-b9f3-476b-9510-5fe37b5781d8.png">\r\n- This PR removes the injected prop from the root of the web application\r\nand instead injects it on the route level by introducing a new component\r\n`EnterpriseRepositoryFileTreePage`. It\'s lazy-loaded and respects the\r\nboundaries between the OSS and enterprise versions of the app.',
    'codeintel: Revive braindot (#49128)',
    'Better import ordering with prettier (#48188)',
    'Merge the history from the Cody repository (#48800)\n\nThis was generated with:\r\n\r\n```\r\ngit remote add cody git@github.com:sourcegraph/cody.git\r\ngit subtree add --prefix=client/cody cody master\r\n```\r\n\r\nThe Cody repository contains prototype frontends which are now defunct\r\nand will be replaced with calls to #48248. The client/cody directory\r\nwill focus on the Cody VSCode extension, and over time Cody will be\r\nintegrated into other clients.\r\n\r\n## Test plan\r\n\r\nSee client/cody/README.md for how to run the tests.\r\n\r\n## App preview:\r\n\r\n- [Web](https://sg-web-dpc-merge-cody.onrender.com/search)\r\n\r\nCheck out the [client app preview\r\ndocumentation](https://docs.sourcegraph.com/dev/how-to/client_pr_previews)\r\nto learn more.\r\n\r\n---------\r\n\r\nCo-authored-by: Beyang Liu <beyang@sourcegraph.com>\r\nCo-authored-by: Rok Novosel <novosel.rok@gmail.com>\r\nCo-authored-by: Rok Novosel <rok@sourcegraph.com>\r\nCo-authored-by: Beatrix <beatrix@sourcegraph.com>\r\nCo-authored-by: Quinn Slack <qslack@qslack.com>\r\nCo-authored-by: Quinn Slack <quinn@slack.org>\r\nCo-authored-by: Jean-Hadrien Chabran <jh@chabran.fr>\r\nCo-authored-by: Beatrix <68532117+abeatrix@users.noreply.github.com>',
    "feat: add local navigation via tree-sitter (#48791)\n\nUse our new scip-syntax to power local symbols for Perl.\r\n\r\nPart of this PR was inlining: https://github.com/sourcegraph/scip-semantic\r\nYou can see development history there for some of the larger sections of code in the newer crates.\r\nIt's possible we will keep this crates here, but that's unclear at the moment.\r\n\r\n\r\n---------\r\n\r\nCo-authored-by: Ólafur Páll Geirsson <olafurpg@gmail.com>",
    'Ship new accessible file and symbol tree (#48610)',
    'Change `useExperimentalFeatures` to use the new `useSettings` API (#48125)\n\nThis PR changes the `useExperimentalFeatures` hook to use the new\r\n`useSettings` API as discussed in #47979.',
    'test: move mockReactVisibilitySensor to shared/testing (#48210)\n\nTo make `client/shared/dev` used for test config/setup, not used during\r\nactual test execution.\r\n\r\nThis way hopefully `@sourcegraph/shared` can be a fully esm package\r\nwhile `client/shared/dev` can be commonjs to be included directly in\r\nthings like jest or mocha config.',
    'enable CodeMirror file view by default (#48034)',
    "Remove ThemeProps and add new theme state logic (#47864)\n\n## Before\r\n\r\nBefore this PR we had theme state on the top level in the Layout.tsx, we\r\nhad a hook that provided an object with public API for theme (to read or\r\nto set a new value), there were at least two problems\r\n- Complex implementation of useThemeProps (rxjs to listen browser theme,\r\nmixed with logic around setting theme CSS classes)\r\n- Prop drilling, after we created these theme API on the top level, it\r\nwas distributed via props\r\n\r\nI think I don't need to dive deep in why prop drilling is a bad\r\npractice, but still, with prop drilling and nested components, we were\r\nupdating the whole react tree when theme was changed, also passing these\r\npublic Theme props required extending your component props with special\r\ntype `ThemeProps` and this becomes a mess quickly if you extend\r\nsomething else (like one component props extended other component props)\r\n\r\n## Now\r\n\r\nIn this PR, we use more standard ways for global state distirubiotion -\r\nContext. In the new `useTheme` hook, we don't do any effects with CSS\r\nclasses (consumer on the top level should handle it), so it's safe to\r\ncall useTheme on any UI level. Privosly it wasn't safe, and because of\r\nthis, we had this problem\r\nhttps://github.com/sourcegraph/sourcegraph/issues/47501\r\n\r\n## Further steps\r\n\r\nIdeally we shouldn't have any JS logic about theme besides CSS classes\r\nset on the document element. And all colors should work through CSS\r\nvariables *custom-properties, but at the moment, we have at least two\r\nmajor places where we have to have JS check about theme.\r\n- Brand logo (since we use svg as image, in img src attribute), we\r\nshould change URL based on theme (in dark theme brand logo has\r\ndifference color value). I'm wondering that we can probably change it\r\nand use svg directly without img tag)\r\n- Monaco editor doesn't support colors through CSS variables, and we\r\nchange set of colors in js runtime based on theme value. I don't know\r\nmaybe with CodeMirror, we could use just CSS variables and remove this\r\nlogic",
    'web: upgrade `react-router` to v6 (#47595)\n\n- Closes #33834\r\n- Upgraded react-router to v6\r\n- Migrated the web application to [the data-aware router introduced in\r\nv6.4.0](https://reactrouter.com/en/main/routers/picking-a-router#using-v64-data-apis).\r\n- Migrated `history.block` usages to the `unstable_useBlock` hook\r\n[introduced in\r\nv6.7.0](https://github.com/remix-run/react-router/issues/8139).\r\n- Removed explicit history reference from the `renderWithBrandedContext`\r\nutility used in unit tests.\r\n- Migrated the search-query state observer from `history.listen` to\r\n`useLocation` API.\r\n\r\n## Test plan\r\n\r\nCI and manually visiting all the pages.',
    "reference panel: Don't error when language spec cannot be found (#47662)\n\nPartially addresses #47619 \r\n\r\nI don't know what the original intend behind throwing an error was, but\r\nfrom a type safety perspective it seems better to return\r\n`undefined`/`null` when the spec is not available and let the UI handle\r\nthe case.\r\n\r\nIn this PR I'm simply rendering the same UI as if the token wasn't\r\nfound.",
    'fix padding in ReferencesPanel (#47515)\n\n- The height for the scrollable viewport was being calculated\r\nincorrectly (it was not taking into account the vertical padding on the\r\nfilter input), which caused the bottom of the scrollable viewport to\r\nlook like it lacked padding between it and the bottom of the window.\r\n- The text when there were no results was too far left.\r\n\r\n\r\n\r\n\r\n## Test plan\r\n\r\nView references panel and note the bottom of the panel has adequate\r\nspacing.',
    'web: remove `history` from the blob components (#47534)\n\n- Part of #33834',
    'Cleanup up legacy blob view (#47380)',
]

const MOCK_QUERIES = {
    wildcardUpdates:
        'patterntype:regexp repo:^github.com/sourcegraph/sourcegraph$ file:client/wildcard/. lang:TypeScript type:commit after:"1 month ago"',
    codyUpdates:
        'patterntype:regexp repo:^github.com/sourcegraph/sourcegraph$ file:client/cody/. type:commit after:"1 week ago"',
}

const getPrompt = ({ commits }: { commits: string[] }): string => `
${commits}\n\n
Write these commits as detailed release notes.\n
The release notes should be written in a format that can easily be understood by anyone.\n
Do not mention the commit hashes.\n
Do not try to preserve any links`

const humanPreamble = getPrompt({ commits: MOCK_COMMITS_PREAMBLE })

const assistantPreamble = `
## Changelog\n\n

### Use native links in references panel\n\n
- Improved the implementation of the references panel by using native <a> tags instead of <div role="link">.
- Added native onDoubleClick handler support, allowing users to open a reference directly in the blob view with a normal double click.
- Enabled right click => Open link in new tab functionality.
- Cmd+click now opens the symbol in a new tab.
- Fixed font inconsistency by using var(--code-font-family); for rendering references.
- Web: Remove CodeMirror from the initial chunk
- Removed CodeMirror from the initial chunk to reduce the load time of the web app.
- Introduced a new lazy-loaded component EnterpriseRepositoryFileTreePage to handle the use of CodeMirror on the route level.\n\n

### Codeintel: Revive braindot\n\n
- Revived the braindot feature in code intelligence.\n\n

### Better import ordering with Prettier\n\n
- Improved import ordering in the codebase using Prettier.\n\n

### Merge the history from the Cody repository\n\n
- Merged the history from the Cody repository into the main repository.
- The Cody repository's prototype frontends will be replaced with calls to #48248.
- The client/cody directory will now focus on the Cody VSCode extension.\n\n

### Add local navigation via tree-sitter for Perl\n\n
- Implemented local symbols for Perl using the new scip-syntax.\n\n

### Ship new accessible file and symbol tree\n\n
- Introduced a new accessible file and symbol tree.\n\n

### Change useExperimentalFeatures to use the new useSettings API\n\n
- Updated the useExperimentalFeatures hook to use the new useSettings API.\n\n

### Test: Move mockReactVisibilitySensor to shared/testing\n\n
- Moved mockReactVisibilitySensor to shared/testing to improve test setup and execution.\n\n

### Enable CodeMirror file view by default\n\n
- CodeMirror file view is now enabled by default.\n\n

### Remove ThemeProps and add new theme state logic\n\n
- Replaced ThemeProps with a more standard global state distribution using React Context.
- Simplified theme state logic and improved performance when changing themes.\n\n

### Web: Upgrade react-router to v6\n\n
- Upgraded react-router to version 6.
- Migrated the web application to the data-aware router introduced in v6.4.0.
- Migrated history.block usages to the unstable_useBlock hook introduced in v6.7.0.
- Removed explicit history reference from the renderWithBrandedContext utility used in unit tests.
- Migrated the search-query state observer from history.listen to useLocation API.\n\n

### Reference panel: Don't error when language spec cannot be found\n\n
- Updated the reference panel to return undefined/null when the language spec is not available, letting the UI handle the case.\n\n

### Fix padding in ReferencesPanel\n\n
- Fixed the height calculation for the scrollable viewport and adjusted padding in the ReferencesPanel.\n\n

### Web: Remove history from the blob components\n\n
- Removed the history reference from the blob components to reduce complexity.\n\n

### Cleanup up legacy blob view\n\n
- Cleaned up the legacy blob view to improve code quality.\n\n
`

const preamble: Message[] = [
    {
        speaker: 'human',
        text: humanPreamble,
    },
    {
        speaker: 'assistant',
        text: assistantPreamble,
    },
]

const markdownPreamble1 = {
    input: {
        heading: 'Update delivering-impact-reviews.md (#6630)',
        description: null,
        diff: 'content/departments/people-talent/people-ops/process/teammate-sentiment/impact-reviews/delivering-impact-reviews.md content/departments/people-talent/people-ops/process/teammate-sentiment/impact-reviews/delivering-impact-reviews.md\n@@ -4,3 +4,3 @@ \n \n-Impact reviews will be delivered synchronously in a 1:1 between the Manager and their direct report. Each Manager is responsible for scheduling a 30 - 60 minute (recommended) meeting with each Teammate to deliver their review packet, along with any corresponding promotion or compensation increases. All conversations must take place no later than **October 14 at the latest.**\n+Impact reviews will be delivered synchronously in a 1:1 between the Manager and their direct report. Each Manager is responsible for scheduling a 30 - 60 minute (recommended) meeting with each Teammate to deliver their review packet, along with any corresponding promotion or compensation increases. All conversations must take place no later than \\*_April 26, 2023 for H1 FY24 Impact Review Cycle_\n \n',
    },
    output: `
    This change updated the deadline for delivering impact reviews.
    - Old deadline: October 14
    - New deadline: April 26, 2023 (H1 FY24 Impact Review Cycle)
    `,
}

const markdownPreamble2 = {
    input: {
        heading: 'updates customer information (#6625)',
        description: 'updated private with more examples of customer information',
        diff: 'content/company-info-and-process/policies/data-sharing.md content/company-info-and-process/policies/data-sharing.md\n@@ -53,3 +53,3 @@ Below you can find a matrix to help you make informed decisions about what data\n    </td>\n-   <td>Customer private source code\n+   <td>Customer private source code snippets (for support purposes)\n    </td>\n@@ -63,3 +63,3 @@ Below you can find a matrix to help you make informed decisions about what data\n    </td>\n-   <td>private repository names, legal contracts, company financials, incident reports for security issues \n+   <td>Customer roadmaps, customer number of codebases, customer challenges, private repository names, legal contracts, company financials, incident reports for security issues, private repository names, legal contracts, company financials, incident reports for security issues \n    </td>\n',
    },
    output: `
    - Updated customer information in the data-sharing policy
    - Added more examples of private customer information
    - Examples include:
        - Customer roadmaps
        - Number of customer codebases
        - Customer challenges
        - Private repository names (repeated)
        - Legal contracts (repeated)
        - Company financials (repeated)
        - Incident reports for security issues (repeated)
        - Customer private source code snippets (for support purposes)
        - This change updated the customer information policy.
    `,
}

const humanCommitPreamble = `
I want you to summarize a change for me, here's an example of a previous conversation we had, so you can understand what to do:\n\n

Human:\n\n
${JSON.stringify(markdownPreamble1.input)}\n\n

Generate a high-level summary of this change in a readable bullet-point list.
Do: Use all the information available to build your summary.
Don't: Mention details like specific files changed or commit hashes.\n\n

Assistant:\n\n
${markdownPreamble1.output}\n\n

Human:\n\n
${JSON.stringify(markdownPreamble2.input)}\n\n

Generate a high-level summary of this change in a readable bullet-point list.
Do: Use all the information available to build your summary.
Don't: Mention details like specific files changed or commit hashes.\n\n
`

const assistantCommitPreamble = `
Assistant:\n\n
${markdownPreamble2.output}\n\n
`

const preambleCommit: Message[] = [
    {
        speaker: 'human',
        text: humanCommitPreamble,
    },
    {
        speaker: 'assistant',
        text: assistantCommitPreamble,
    },
]

interface CommitPromptInput {
    input: {
        heading: string
        description: string | null
        diff: string | null
    }
}

const getCommitPrompt = ({ input }: CommitPromptInput): string => `
Human:\n\n
${JSON.stringify(input)}\n\n.

Generate a high-level summary of this change in a readable bullet-point list.
Do: Use all the information available to build your summary.
Don't: Mention details like specific files changed or commit hashes.\n\n

Assistant:\n\n
- `

interface ExampleChangelogProps {
    name: string
    query: string
}

const SEARCH_QUERY = gql`
    query SearchForChanges($query: String!) {
        search(query: $query) {
            results {
                results {
                    ... on CommitSearchResult {
                        ...SearchCommitSearchResult
                    }
                }
            }
        }
    }

    fragment SearchCommitSearchResult on CommitSearchResult {
        url
        diffPreview {
            value
        }
        commit {
            subject
            body
        }
    }
`

const ExampleChangelog: React.FunctionComponent<ExampleChangelogProps> = ({ name, query }) => {
    const [queryState, setQueryState] = useState<QueryState>({ query })
    const [searchForCommits, { data, loading, error }] = useLazyQuery<
        SearchForChangesResult,
        SearchForChangesVariables
    >(SEARCH_QUERY, {
        variables: { query },
    })

    const results = data?.search?.results.results as SearchCommitSearchResult[]

    return (
        <Container className="mt-2">
            <div>
                <H3>{name}</H3>
            </div>
            <div>
                <LazyQueryInput
                    className="test-trigger-input"
                    patternType={SearchPatternType.standard}
                    caseSensitive={false}
                    isSourcegraphDotCom={window.context.sourcegraphDotComMode}
                    queryState={queryState}
                    onChange={setQueryState}
                    preventNewLine={true}
                    autoFocus={true}
                    applySuggestionsOnEnter={true}
                />
            </div>
            <div className="d-flex flex-column align-items-center mt-2">
                {loading ? (
                    <>
                        <LoadingSpinner />
                        <small>Looking for changes...</small>
                    </>
                ) : error ? (
                    <>
                        <ErrorAlert error={error} />
                    </>
                ) : results ? (
                    <Container className="w-100">
                        {results.map((result, index) => (
                            <ExampleChangeLogCommit change={result} key={index} />
                        ))}
                    </Container>
                ) : (
                    <Button
                        variant="primary"
                        onClick={() => searchForCommits()}
                        disabled={Boolean(results) || loading}
                        className="align-self-start"
                    >
                        Generate changelog
                    </Button>
                )}
            </div>
        </Container>
    )
}

interface ExampleChangeLogCommitProps {
    change: SearchCommitSearchResult
}

const ExampleChangeLogCommit: React.FunctionComponent<ExampleChangeLogCommitProps> = ({ change }) => {
    const [expanded, setExpanded] = useState<boolean>(false)

    const [messageInProgress, setMessageInProgress] = useState<ChatMessage | null>(null)
    const [transcript, setTranscript] = useState<ChatMessage[]>([])
    const [codyClient, setCodyClient] = useState<Client | ErrorLike>()

    useEffect(() => {
        createClient({
            config: { serverEndpoint: window.location.origin, useContext: 'embeddings' },
            accessToken: null,
            setMessageInProgress,
            setTranscript,
            preamble: preambleCommit,
        }).then(setCodyClient, setCodyClient)
    }, [])

    useEffect(() => {
        if (codyClient && !isErrorLike(codyClient)) {
            const input = {
                heading: '',
                // heading: change.commit.subject,
                description: '',
                // description: change.commit.body,
                diff: change.diffPreview?.value ?? null,
            }
            codyClient.submitMessage(getCommitPrompt({ input }))
        }
    }, [change, codyClient])

    const lastResponse = transcript[transcript.length - 1]?.speaker === 'assistant' && transcript[transcript.length - 1]

    return (
        <div className="d-flex flex-column mb-3">
            <div className="d-flex align-items-center justify-content-between">
                <Link to={change.url}>
                    <H3 className="mb-2">{change.commit.subject}</H3>
                </Link>
            </div>
            <div>
                {messageInProgress && (
                    <>
                        <LoadingSpinner />
                        <small>Generating summary...</small>
                    </>
                )}
                {lastResponse && lastResponse.speaker === 'assistant' && (
                    <Markdown dangerousInnerHTML={renderMarkdown(lastResponse.displayText)} />
                )}
            </div>
        </div>
    )
}

export const ChangelogAnywhereList: React.FunctionComponent<React.PropsWithChildren<ChangelogAnywhereListProps>> = ({
    authenticatedUser,
    toggleCodeMonitorEnabled,
}) => (
    <>
        <div className="row mb-5">
            <div className="d-flex flex-column w-100 col">
                <div className="d-flex align-items-center justify-content-between">
                    <H3 className="mb-2">Your changelogs</H3>
                </div>
                <ExampleChangelog
                    name="Staying up to date: Cody changes in the Sourcegraph repo, in the last week"
                    query='patterntype:regexp repo:^github.com/sourcegraph/sourcegraph$ file:client/cody/. type:diff after:"1 week ago"'
                />
                <ExampleChangelog
                    name="Incident runbook: Infrastructure changes across Sourcegraph repos, in the last month"
                    query='patterntype:regexp repo:github.com/sourcegraph/. type:diff after:"1 month ago" file:(.tf$|.tfvars$)'
                />
                <ExampleChangelog
                    name="Morning catch up: Frontend changes since yesterday"
                    query='patterntype:regexp repo:^github\.com/sourcegraph/sourcegraph$ type:diff lang:TypeScript after:"yesterday"'
                />
                <ExampleChangelog
                    name="What changed in the handbook in the last week?"
                    query='patterntype:regexp repo:^github\.com/sourcegraph/handbook$ type:diff after:"1 week ago"'
                />
                <ExampleChangelog
                    name="What's new in the Sourcegraph docs this week?"
                    query='patternType:regexp repo:^github\.com/sourcegraph/sourcegraph$ type:diff file:doc/. after:"1 week ago"'
                />
                <ExampleChangelog
                    name="What did I do last week?"
                    query='patternType:regexp repo:^github\.com/sourcegraph/sourcegraph$ type:diff author:umpox after:"10 weeks ago"'
                />
                <ExampleChangelog
                    name="What has the React team been working on?"
                    query='patternType:regexp repo:^github\.com/facebook/react$ type:diff after:"last week"'
                />
            </div>
        </div>
        <div className="mt-5">
            We want to hear your feedback! <Link to="mailto:feedback@sourcegraph.com">Share your thoughts</Link>
        </div>
    </>
)
