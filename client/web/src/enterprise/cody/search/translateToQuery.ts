import { AuthenticatedUser } from '@sourcegraph/shared/src/auth'

import { CompletionRequest, getCodyCompletionOneShot } from '../api'

export async function translateToQuery(input: string, user: AuthenticatedUser): Promise<string | null> {
    const messages = getCompletionRequestMessages(input, user)
    const result = await getCodyCompletionOneShot(messages)
    if (!result.includes('contents>') && !result.includes('filters>')) {
        return null
    }
    const query = result
        .replace('<contents>', ' ')
        .replace('</contents>', ' ')
        .replace('<filters>', ' ')
        .replace('</filters>', ' ')
        .replace(/\n/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim()
    return query
}

const getCompletionRequestMessages = (input: string, user: AuthenticatedUser): CompletionRequest['messages'] => ([
    {
        speaker: 'human',
        text:
            `I am a sourcegraph user and my username is ${user.username}.\n` +

            'You are an expert at writing queries that match what a human requests. A typical query describes content or filenames to find across all repositories using the following structure: <contents>REGEXP</contents><filters>FILTER FILTER FILTER...</fitlers>.\n' +

            'REGEXP is a regular expression used to match file content in the repositories. REGEXP in put inside the <contents> block. You may leave the <contents></contents> block empty.\n' +

            'FILTER has the following structure tag:value. You can put multiple FILTER inside the <filters> block like <filters>repo:my_repo lang:typescript type:symbol</fitlers>. FILTER is used to limit search to specific repositories or files. Multiple or combined FILTER are intersected.' +

            'The following FILTERS are available for writing the queries:\n' +

            '1. <filters>repo:REPO-NAME-REGEXP</filters>. Only include results from repositories whose path matches the REPO-NAME-REGEXP.\n' +

            '2. <filters>repo:REPO-NAME-REGEXP@REVISION</filters> or <filters>repo:REPO-NAME-REGEXP rev:REVISION</filters>. The REVISION part refers to repository revisions (branches, commit hashes, and tags) and may take on the following forms: @branch (a branch name), @1735d48 (a commit hash), @3.15 (a tag). If you want results from specific branch my_branch on a repo use <fitlers>repo:REPO-NAME-REGEXP@my_branch</fitlers> or <filter>repo:REPO-NAME-REGEXP rev:my_branch</filters>. If you want results from specific commit 1735d48 in a repo use <filters>repo:REPO-NAME-REGEXP@1735d48</fitlers> or <filters>repo:REPO-NAME-REGEXP rev:1735d48</fitlers>.\n' +

            '3. <filters>-repo:REPO-NAME-REGEXP</filters>. It excludes results from repositories whose path matches the REPO-NAME-REGEXP. It can be used in combination of repo:REPO-NAME-REGEXP filter. If you want to include frontend repo and exclude backend repo use <filters>repo:frontend -repo:backend</filters>.\n' +

            '4. <filters>file:PATH-REGEXP</filters>. Only include results in files whose full path matches the PATH_REGEXP. Always use the <filters>file:PATH-REGEXP</filters> filter to narrow the query to only specific files. Escape any special characters in the regular expression to match file contents (such as \\* to match a literal *).\n' +

            '5. <filters>-file:PATH-REGEXP</filters>. It excludes results in files whose full path matches the PATH_REGEXP. It can be used in combination of file:PATH-REGEXP filter. If you want to include \\.go files and exclude _test\\.go files use <filters>file:\\.go -file:_test\\.go</filters>.\n' +

            '6. <filters>file:has.owner(USER)</filters>. Only include results from files owned by USER.\n' +

            '7. <filters>lang:LANGUAGE</filters>. Only include results from files in the specified LANGUAGE. LANGUAGE can be typescript, javascript, go, css, scss, html, markdown, rust, c++, java, etc.\n' +

            '8. <filters>type:SEARCH_TYPE</filters>. SEARCH_TYPE Specifies the type of search. If you want to search over changes to code use type:diff. If you want to search over a commit message use type:commit. If you want to search for a symbol use type:symbol.\n' +

            '9. <filters>author:"AUTHOR_PATTERN"</filters>. Only include results from diffs or commits authored by AUTHOR_PATTERN. Regexps are supported for AUTHOR_PATTERN. AUTHOR_PATTERN is of the form "Full Name <user@example.com>", where Full Name is name of the author and user@example.com is the email of the author. To include diffs or commits from authors from a specific domain, use <filters>author:"example.com>$"</filters>. To include diffs or commits from author having USERNAME as name use <filters>author:"USERNAME"</filters>. You must include either type:diff filter or type:commit filter to use author filter. Do not escape special characters in AUTHOR_PATTERN.\n' +

            '10. <filters>author:@SOURCEGRAPH_USERNAME</filters>. Only include results from diffs or commits authored by the Sourcegraph user having either email or username matching with SOURCEGRAPH_USERNAME. SOURCEGRAPH_USERNAME is the username of user in the sourcegraph instance. To include diffs or commits from sourcegraph user having username as SG_USER use <filters>author:@SG_USER</filters>. You must include either type:diff filter or type:commit filter to use author filter.\n' +

            '11. <filters>-author:"AUTHOR_PATTERN"</filters>. Excludes results from diffs or commits authored by AUTHOR_PATTERN. Regexps are supported for AUTHOR_PATTERN. AUTHOR_PATTERN is of the form "Full Name <user@example.com>", where Full Name is name of the author and user@example.com is the email of the author. To exclude diffs or commits from authors from a specific domain, use <filters>-author:"example.com>$"</filters>. To exclude diffs or commits from author having USERNAME as name but include diffs or commit from author having ANOTHER_USER as name use <filters>authro:"ANOTHER_USER" -author:"USERNAME"</filters>. You must include either type:diff filter or type:commit filter to use author filter.\n' +

            '12. <filters>-author:@SOURCEGRAPH_USERNAME</filters>. Exclude results from diffs or commits authored by the Sourcegraph user having either email or username matching with SOURCEGRAPH_USERNAME. SOURCEGRAPH_USERNAME is the username of user in the sourcegraph instance. To exclude diffs or commits from sourcegraph user having username as SG_USER but include diffs or commits from sourcegraph user having username as ANOTHER_SG_USER use <filters>author:@ANOTHER_SG_USER -author:@SG_USER</filters>. You must include either type:diff filter or type:commit filter to use author filter.\n' +

            '13. <filters>before:"TIME_FRAME"</filters> Only include results from diffs or commits which have a commit date before the specified TIME_FRAME. To only include diff or commits before last thursday use <filters>before:"last thursday"</filters>. To only include diffs or commits before 1 november 2020 use <filters>before:"1 november 2020". You must include either type:diff filter or type:commit filter to use before filter.\n' +

            '14. <filters>after:"TIME_FRAME"</filters> Only include results from diffs or commits which have a commit date after the specified TIME_FRAME. To only include diff or commits after last thursday use <filters>after:"last thursday"</filters>. To only include diffs or commits after 1 november 2020 use <filters>after:"1 november 2020". You must include either type:diff filter or type:commit filter to use after filter.\n'
    },
    { speaker: 'assistant', text: 'Understood. I will follow these rules.' },

    // repo filter basic
    { speaker: 'human', text: 'What is the query for <request>multierror repo</request>?' },
    { speaker: 'assistant', text: '<contents></contents><filters>repo:multierror</filters>' },

    // repo filter with branch name tag
    { speaker: 'human', text: 'What is the query for <request>branch user/bug-fix on react repo</request>?' },
    { speaker: 'assistant', text: '<contents></contents><filters>repo:react@user/bug-fix</filters>' },

    // repo filter with commit tag
    { speaker: 'human', text: 'What is the query for <request>commit 1g246ih in express repo</request>?' },
    { speaker: 'assistant', text: '<contents></contents><filters>repo:express@1g246ih</filters>' },

    // excluding repo fitler
    { speaker: 'human', text: 'What is the query for <request>featureFlags excluding dotenv repo</request>?' },
    { speaker: 'assistant', text: '<contents>featureFlags</contents><filters>-repo:dotenv</filters>' },

    // both excluding & including repo fitler
    { speaker: 'human', text: 'What is the query for <request>all microsoft repo excluding windows98</request>?' },
    { speaker: 'assistant', text: '<contents></contents><filters>repo:microsoft -repo:windows98</filters>' },

    // file filter with npm package file name
    { speaker: 'human', text: 'What is the query for <request>npm packages that depend on react</request>?' },
    { speaker: 'assistant', text: '<contents>"react"</contents><filters>file:package\\.json</filters>' },

    // file filter with file path regexp
    { speaker: 'human', text: 'What is the query for <request>styles/**.scss files</request>?' },
    { speaker: 'assistant', text: '<contents></contents><filters>file:styles/**\\.scss</filters>' },

    // file filter with directory regexp
    { speaker: 'human', text: 'What is the query for <request>files in styles directory</request>?' },
    { speaker: 'assistant', text: '<contents></contents><filters>file:styles</filters>' },

    // file filter with go test files specific directory regexp
    { speaker: 'human', text: 'what is the query for <request>go test files in the client directory that contain the string "openid"</request>?', },
    { speaker: 'assistant', text: '<contents>openid</contents><filters>file:client/ file:_test\\.go$</filters>' },

    // file filter with graphql query files specific directory regexp
    { speaker: 'human', text: 'what is the query for <request>graphql files in the backend directory that includes currentUser: User"</request>?', },
    { speaker: 'assistant', text: '<contents>currentUser: User</contents><filters>file:backend/ file:\\.graphql$</filters>' },

    // file filter with owner tag
    { speaker: 'human', text: 'What is the query for <request>changes to go files owned by alice</request>?' },
    { speaker: 'assistant', text: '<contents></contents><filters>type:diff lang:go file:has.owner(alice)</filters>', },

    // file filter with owner tag react storybook specific
    { speaker: 'human', text: 'What is the query for <request>React storybook files owned by alice</request>?' },
    { speaker: 'assistant', text: '<contents>@storybook/react</contents><filters>file:has.owner(alice)</filters>' },

    // file filter with repo
    { speaker: 'human', text: 'What is the query for <request>hooks/use.*\\.tsx files in nextjs repo</request>?' },
    { speaker: 'assistant', text: '<contents></contents><filters>file:hooks/use.*\\.tsx repo:nextjs</filters>' },

    // file filter with dir and exluding repo
    { speaker: 'human', text: 'What is the query for <request>pages dir excluding vue repo</request>?' },
    { speaker: 'assistant', text: '<contents></contents><filters>file:pages/ -repo:vue</filters>' },

    // file filter with directory inside repo
    { speaker: 'human', text: 'What is the query for <request>components directory in frontend repo</request>?' },
    { speaker: 'assistant', text: '<contents></contents><filters>file:components repo:frontend/</filters>' },

    // excluding file fitler
    { speaker: 'human', text: 'What is the query for <request>NewUser excluding go test files</request>?' },
    { speaker: 'assistant', text: '<contents>NewUser</contents><filters>-file:_test\\.go$</filters>' },

    // both including and excluding file filter 
    { speaker: 'human', text: 'What is the query for <request>all scss files in styles folder excluding global\\.scss file</request>?' },
    { speaker: 'assistant', text: '<contents></contents><filters>file:styles/.*\\.scss$ -file:global\\.scss lang:scss</filters>' },

    // diff filter
    { speaker: 'human', text: 'What is the query for <request>changes to authentication</request>?' },
    { speaker: 'assistant', text: '<contents>authentication</contents><filters>type:diff</filters>' },

    // diff filter for repo with commit tag
    { speaker: 'human', text: 'What is the query for <request>diff under commit 6k3j5ip on tensorflow repository</request>?' },
    { speaker: 'assistant', text: '<contents></contents><filters>repo:tensorflow@6k3j5ip type:diff</filters>' },

    // diff filter with nested file
    { speaker: 'human', text: 'What is the query for <request>changes made to .btn in global\\.css in styles directory</request>?' },
    { speaker: 'assistant', text: '<contents>.btn</contents><filters>type:diff lang:css file:styles/.*global\\.css</filters>' },

    // diff filter with language
    { speaker: 'human', text: 'What is the query for <request>diff for rust files</request>?' },
    { speaker: 'assistant', text: '<contents></contents><filters>type:diff lang:rust</filters>' },

    // diff filter with file directory
    { speaker: 'human', text: 'What is the query for <request>changes inside config/aws directory</request>?' },
    { speaker: 'assistant', text: '<contents></contents><filters>type:diff file:config/aws/</filters>' },

    // diff filter with file directory and query
    { speaker: 'human', text: 'What is the query for <request>changes to .button under styles directory</request>?' },
    { speaker: 'assistant', text: '<contents>.button</contents><filters>type:diff file:styles/</filters>' },

    // diff filter for package.json with before
    { speaker: 'human', text: 'What is the query for <request>node packages changes before last friday</request>?' },
    { speaker: 'assistant', text: '<contents></contents><filters>type:diff file:package\\.json before:"last friday"</filters>' },

    // diff filter for symbol with before
    { speaker: 'human', text: 'What is the query for <request>changes to useAuthenticatedUser before september 17 1998</request>?' },
    { speaker: 'assistant', text: '<contents>useAuthenticatedUser</contents><filters>type:diff before:"september 17 1998"</filters>' },

    // diff filter for nested file with after
    { speaker: 'human', text: 'What is the query for <request>diffs for file init\\.ts inside server dir after 3 weeks ago</request>?' },
    { speaker: 'assistant', text: '<contents></contents><filters>type:diff file:server/.*init\\.ts after:"3 weeks ago"</filters>' },

    // diff filter for symbol with after
    { speaker: 'human', text: 'What is the query for <request>changes to useAuthenticatedUser after september 17 1998</request>?' },
    { speaker: 'assistant', text: '<contents>useAuthenticatedUser</contents><filters>type:diff after:"september 17 1998"</filters>' },

    // author filter with pattern
    { speaker: 'human', text: 'What is the query for <request>modifications made to go routes file by mrnugget</request>?' },
    { speaker: 'assistant', text: '<contents></contents><filters>file:routes\\.go type:diff author:"mrnugget"</filters>' },

    // author filter with file and diff
    { speaker: 'human', text: 'What is the query for <request>changes to schema.graphql file by Rahul Gandhi <rahul@gmail.com></request>?' },
    { speaker: 'assistant', text: '<contents></contents><filters>file:schema.graphql type:diff author:"Rahul Gandhi <rahul@gmail.com>"</filters>' },

    // author filter with search and diff
    { speaker: 'human', text: 'What is the query for <request>changes to useLocalStorage by @ryan</request>?' },
    { speaker: 'assistant', text: '<contents>useLocalStorage</contents><filters>type:diff author:@ryan</filters>' },

    // author filter with me in nested dir
    { speaker: 'human', text: 'What is the query for <request>changes made to go files in graphqlbackend dir by me</request>?' },
    { speaker: 'assistant', text: `contents></contents><filters>file:graphqlbackend/.*\\.go type:diff author:@${user.username}</filters>` },

    // including authors from domain but excluding myself
    { speaker: 'human', text: 'What is the query for <request>changes made to schema.graphql by users having email domain gmail\\.com excluding myself</request>?' },
    { speaker: 'assistant', text: `contents></contents><filters>file:schema.graphql type:diff author:"@gmail.com$" -author:@${user.username}</filters>` },

    // commits by authors from domain but excluding pattern
    { speaker: 'human', text: 'What is the query for <request>commits by users from domain outlook\\.com excluding @kyle</request>?' },
    { speaker: 'assistant', text: `contents></contents><filters>type:commit author:"@outlook.com$" -author:@kyle</filters>` },

    // symbol filter with query
    { speaker: 'human', text: 'What is the query for <request>isAuthenticated symbol</request>?' },
    { speaker: 'assistant', text: '<contents>isAuthenticated</contents><filters>type:symbol</filters>' },

    // symbol filter with filePath
    { speaker: 'human', text: 'What is the query for <request>getUserByID symbol in models/users\\.rb</request>?' },
    { speaker: 'assistant', text: '<contents>getUserByID</contents><filters>file:models/users\\.rb type:symbol</filters>' },

    // symbol filter with repo
    { speaker: 'human', text: 'What is the query for <request>Auth symbol in rails repo</request>?' },
    { speaker: 'assistant', text: '<contents>Auth</contents><filters>repo:rails type:symbol</filters>' },

    // symbol filter with excluding repo
    { speaker: 'human', text: 'What is the query for <request>passport symbol exluding node repo</request>?' },
    { speaker: 'assistant', text: '<contents>passport</contents><filters>-repo:node type:symbol</filters>' },

    // symbol filter with both including and excluding repo
    { speaker: 'human', text: 'What is the query for <request>Middleware symbol in express repo exluding node repo</request>?' },
    { speaker: 'assistant', text: '<contents>Middleware</contents><filters>repo:express -repo:node type:symbol</filters>' },

    // symbol filter vs diff filter
    { speaker: 'human', text: 'What is the query for <request>changes to login symbol in javascript file</request>?' },
    { speaker: 'assistant', text: '<contents>login</contents><filters>type:diff lang:javascript</filters>' },

    // language fitler
    { speaker: 'human', text: 'What is the query for <request>typescript files</request>?' },
    { speaker: 'assistant', text: '<contents></contents><filters>lang:go</filters>' },

    // language fitler with query
    { speaker: 'human', text: 'What is the query for <request>golang oauth</request>?' },
    { speaker: 'assistant', text: '<contents>oauth</contents><filters>lang:go</filters>' },

    // language fitler with react hook specific query
    { speaker: 'human', text: 'What is the query for <request>TypeScript files that define a React hook</request>' },
    { speaker: 'assistant', text: '<contents>^export (const|function) use\\w+</contents><filters>lang:typescript</filters>' },

    // language fitler with react class component specific query
    { speaker: 'human', text: 'What is the query for <request>react class components</request>?' },
    { speaker: 'assistant', text: '<contents>class \\w+ extends React\\.Component</contents><filters>(lang:typescript OR lang:javascript)</filters>', },

    // language fitler with repo
    { speaker: 'human', text: 'What is the query for <request>python files in numpy repo</request>?' },
    { speaker: 'assistant', text: '<contents></contents><filters>lang:python repo:numpy</filters>' },

    // language filter with excluding repo
    { speaker: 'human', text: 'What is the query for <request>scss files excluding tailwind repo</request>?' },
    { speaker: 'assistant', text: '<contents></contents><filters>lang:scss -repo:tailwind</filters>' },

    // fallback
    { speaker: 'human', text: 'What is the query for <request>DFH84fHAg</request>?' },
    { speaker: 'assistant', text: 'I apologize, but I do not understand the request "DFH84fHAg". Without more context about what is being requested, I cannot generate a valid query.', },
    { speaker: 'human', text: 'NEVER ASK FOR MORE CONTEXT and ALWAYS MAKE A GUESS. If you are unsure, just treat the entire request as a regular expression matching file contents. What is the query for <request>DFH84fHAg</request>?' },
    { speaker: 'assistant', text: '<contents>DFH84fHAg</contents><filters></filters>' },

    // actual user query
    { speaker: 'human', text: `What is the query for <request>${input}</request>?` },
    { speaker: 'assistant', text: '' },
])
