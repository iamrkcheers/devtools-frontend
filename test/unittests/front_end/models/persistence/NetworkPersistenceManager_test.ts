// Copyright 2022 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

const {assert} = chai;

import * as Bindings from '../../../../../front_end/models/bindings/bindings.js';
import * as Persistence from '../../../../../front_end/models/persistence/persistence.js';
import * as Host from '../../../../../front_end/core/host/host.js';
import * as Root from '../../../../../front_end/core/root/root.js';
import * as SDK from '../../../../../front_end/core/sdk/sdk.js';
import * as Workspace from '../../../../../front_end/models/workspace/workspace.js';
import type * as Platform from '../../../../../front_end/core/platform/platform.js';
import {describeWithMockConnection} from '../../helpers/MockConnection.js';
import {initializeGlobalVars, deinitializeGlobalVars, createTarget} from '../../helpers/EnvironmentHelpers.js';
import {createFileSystemUISourceCode} from '../../helpers/UISourceCodeHelpers.js';

async function setUpEnvironment() {
  const workspace = Workspace.Workspace.WorkspaceImpl.instance();
  const targetManager = SDK.TargetManager.TargetManager.instance();
  const debuggerWorkspaceBinding =
      Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance({forceNew: true, targetManager, workspace});
  const breakpointManager = Bindings.BreakpointManager.BreakpointManager.instance(
      {forceNew: true, targetManager, workspace, debuggerWorkspaceBinding});
  Persistence.Persistence.PersistenceImpl.instance({forceNew: true, workspace, breakpointManager});
  const networkPersistenceManager =
      Persistence.NetworkPersistenceManager.NetworkPersistenceManager.instance({forceNew: true, workspace});
  return {networkPersistenceManager};
}

async function setUpHeaderOverrides() {
  createTarget();
  const {networkPersistenceManager} = await setUpEnvironment();
  const uiSourceCodeMap = new Map<string, Workspace.UISourceCode.UISourceCode>();
  const fileSystem = {
    fileSystemPath: () => 'file:///path/to/overrides',
    fileSystemBaseURL: 'file:///path/to/overrides/',
    uiSourceCodeForURL: (url: string): Workspace.UISourceCode.UISourceCode | null => uiSourceCodeMap.get(url) || null,
  } as unknown as Persistence.FileSystemWorkspaceBinding.FileSystem;

  const globalHeaders = `[
    {
      "applyTo": "*",
      "headers": {
        "age": "overridden"
      }
    }
  ]`;

  const exampleHeaders = `[
    {
      "applyTo": "index.html",
      "headers": {
        "index-only": "only added to index.html"
      }
    },
    {
      "applyTo": "*.css",
      "headers": {
        "css-only": "only added to css files"
      }
    },
    {
      "applyTo": "path/to/*.js",
      "headers": {
        "another-header": "only added to specific path"
      }
    }
  ]`;

  const exampleSourceCode = {
    requestContent: () => {
      return Promise.resolve({content: exampleHeaders});
    },
    url: () => 'file:///path/to/overrides/www.example.com/.headers',
    project: () => fileSystem,
    name: () => '.headers',
  } as unknown as Workspace.UISourceCode.UISourceCode;

  const globalSourceCode = {
    requestContent: () => {
      return Promise.resolve({content: globalHeaders});
    },
    url: () => 'file:///path/to/overrides/.headers',
    project: () => fileSystem,
    name: () => '.headers',
  } as unknown as Workspace.UISourceCode.UISourceCode;

  uiSourceCodeMap.set(exampleSourceCode.url(), exampleSourceCode);
  uiSourceCodeMap.set(globalSourceCode.url(), globalSourceCode);

  const mockProject = {
    uiSourceCodes: () => [exampleSourceCode, globalSourceCode],
    id: () => 'file:///path/to/overrides',
  } as unknown as Workspace.Workspace.Project;

  await networkPersistenceManager.setProject(mockProject);
  SDK.NetworkManager.MultitargetNetworkManager.instance().setInterceptionHandlerForPatterns = async () => {};
  await networkPersistenceManager.updateInterceptionPatternsForTests();
  return {networkPersistenceManager};
}

describeWithMockConnection('NetworkPersistenceManager', () => {
  beforeEach(() => {
    Root.Runtime.experiments.register(Root.Runtime.ExperimentName.HEADER_OVERRIDES, '');
    Root.Runtime.experiments.enableForTest(Root.Runtime.ExperimentName.HEADER_OVERRIDES);
  });

  it('merges request headers with override without overlap', async () => {
    const {networkPersistenceManager} = await setUpHeaderOverrides();
    const interceptedRequest = {
      request: {
        url: 'https://www.example.com/',
      },
      responseHeaders: [
        {name: 'server', value: 'DevTools mock server'},
      ],
    } as SDK.NetworkManager.InterceptedRequest;

    const expected = [
      {name: 'server', value: 'DevTools mock server'},
      {name: 'age', value: 'overridden'},
      {name: 'index-only', value: 'only added to index.html'},
    ];
    assert.deepEqual(await networkPersistenceManager.handleHeaderInterception(interceptedRequest), expected);
  });

  it('merges request headers with override with overlap', async () => {
    const {networkPersistenceManager} = await setUpHeaderOverrides();
    const interceptedRequest = {
      request: {
        url: 'https://www.example.com/index.html',
      },
      responseHeaders: [
        {name: 'server', value: 'DevTools mock server'},
        {name: 'age', value: '1'},
      ],
    } as SDK.NetworkManager.InterceptedRequest;

    const expected = [
      {name: 'server', value: 'DevTools mock server'},
      {name: 'age', value: 'overridden'},
      {name: 'index-only', value: 'only added to index.html'},
    ];
    assert.deepEqual(await networkPersistenceManager.handleHeaderInterception(interceptedRequest), expected);
  });

  it('merges request headers with override with file type wildcard', async () => {
    const {networkPersistenceManager} = await setUpHeaderOverrides();
    const interceptedRequest = {
      request: {
        url: 'https://www.example.com/styles.css',
      },
      responseHeaders: [
        {name: 'server', value: 'DevTools mock server'},
        {name: 'age', value: '1'},
      ],
    } as SDK.NetworkManager.InterceptedRequest;

    const expected = [
      {name: 'server', value: 'DevTools mock server'},
      {name: 'age', value: 'overridden'},
      {name: 'css-only', value: 'only added to css files'},
    ];
    assert.deepEqual(await networkPersistenceManager.handleHeaderInterception(interceptedRequest), expected);
  });

  it('merges request headers with override with specific path', async () => {
    const {networkPersistenceManager} = await setUpHeaderOverrides();
    const interceptedRequest = {
      request: {
        url: 'https://www.example.com/path/to/script.js',
      },
      responseHeaders: [
        {name: 'server', value: 'DevTools mock server'},
        {name: 'age', value: '1'},
      ],
    } as SDK.NetworkManager.InterceptedRequest;

    const expected = [
      {name: 'server', value: 'DevTools mock server'},
      {name: 'age', value: 'overridden'},
      {name: 'another-header', value: 'only added to specific path'},
    ];
    assert.deepEqual(await networkPersistenceManager.handleHeaderInterception(interceptedRequest), expected);
  });

  it('merges request headers only when domain matches', async () => {
    const {networkPersistenceManager} = await setUpHeaderOverrides();
    const interceptedRequest = {
      request: {
        url: 'https://www.web.dev/index.html',
      },
      responseHeaders: [
        {name: 'server', value: 'DevTools mock server'},
      ],
    } as SDK.NetworkManager.InterceptedRequest;

    const expected = [
      {name: 'server', value: 'DevTools mock server'},
      {name: 'age', value: 'overridden'},
    ];
    assert.deepEqual(await networkPersistenceManager.handleHeaderInterception(interceptedRequest), expected);
  });

  it('updates active state when target detach and attach', async () => {
    const {networkPersistenceManager} = await setUpEnvironment();
    const {project} =
        createFileSystemUISourceCode({url: 'file:///tmp' as Platform.DevToolsPath.UrlString, mimeType: 'text/plain'});
    await networkPersistenceManager.setProject(project);
    const targetManager = SDK.TargetManager.TargetManager.instance();
    assert.isNull(targetManager.mainTarget());
    assert.isFalse(networkPersistenceManager.active());

    const target = await createTarget();
    assert.isTrue(networkPersistenceManager.active());

    targetManager.removeTarget(target);

    assert.isFalse(networkPersistenceManager.active());
  });

  it('translates URLs into raw and encoded paths', async () => {
    const {networkPersistenceManager} = await setUpHeaderOverrides();
    let toTest = [
      // Simple tests.
      {
        url: 'www.example.com/',
        raw: 'www.example.com/index.html',
        encoded: 'www.example.com/index.html',
      },
      {
        url: 'www.example.com/simple',
        raw: 'www.example.com/simple',
        encoded: 'www.example.com/simple',
      },
      {
        url: 'www.example.com/hello/foo/bar',
        raw: 'www.example.com/hello/foo/bar',
        encoded: 'www.example.com/hello/foo/bar',
      },
      {
        url: 'www.example.com/.',
        raw: 'www.example.com/.',
        encoded: 'www.example.com/',
      },
      {
        url: 'localhost:8090/endswith.',
        raw: 'localhost:8090/endswith.',
        encoded: 'localhost:8090/endswith.',
      },
      // Query parameters.
      {
        url: 'example.com/fo?o/bar',
        raw: 'example.com/fo?o%2Fbar',
        encoded: 'example.com/fo%3Fo%252Fbar',
      },
      {
        url: 'example.com/foo?/bar',
        raw: 'example.com/foo?%2Fbar',
        encoded: 'example.com/foo%3F%252Fbar',
      },
      {
        url: 'example.com/foo/?bar',
        raw: 'example.com/foo/?bar',
        encoded: 'example.com/foo/%3Fbar',
      },
      {
        url: 'example.com/?foo/bar/3',
        raw: 'example.com/?foo%2Fbar%2F3',
        encoded: 'example.com/%3Ffoo%252Fbar%252F3',
      },
      {
        url: 'example.com/foo/bar/?3hello/bar',
        raw: 'example.com/foo/bar/?3hello%2Fbar',
        encoded: 'example.com/foo/bar/%3F3hello%252Fbar',
      },
      {url: 'https://www.example.com/?foo=bar', raw: 'www.example.com/?foo=bar', encoded: 'www.example.com/%3Ffoo=bar'},
      {
        url: 'http://www.example.com/?foo=bar/',
        raw: 'www.example.com/?foo=bar%2F',
        encoded: 'www.example.com/%3Ffoo=bar%252F',
      },
      {
        url: 'http://www.example.com/?foo=bar?',
        raw: 'www.example.com/?foo=bar?',
        encoded: 'www.example.com/%3Ffoo=bar%3F',
      },
      // Hash parameters.
      {
        url: 'example.com/?foo/bar/3#hello/bar',
        raw: 'example.com/?foo%2Fbar%2F3',
        encoded: 'example.com/%3Ffoo%252Fbar%252F3',
      },
      {
        url: 'example.com/#foo/bar/3hello/bar',
        raw: 'example.com/index.html',
        encoded: 'example.com/index.html',
      },
      {
        url: 'example.com/foo/bar/#?3hello/bar',
        raw: 'example.com/foo/bar/index.html',
        encoded: 'example.com/foo/bar/index.html',
      },
      {
        url: 'example.com/foo.js#',
        raw: 'example.com/foo.js',
        encoded: 'example.com/foo.js',
      },
      {
        url: 'http://www.web.dev/path/page.html#anchor',
        raw: 'www.web.dev/path/page.html',
        encoded: 'www.web.dev/path/page.html',
      },
      {
        url: 'http://www.example.com/file&$*?.html',
        raw: 'www.example.com/file&$%2A?.html',
        encoded: 'www.example.com/file&$%252A%3F.html',
      },
      {
        url: 'localhost:8090/',
        raw: 'localhost:8090/index.html',
        encoded: 'localhost:8090/index.html',
      },
      {url: 'localhost:8090/lpt1', raw: 'localhost:8090/lpt1', encoded: 'localhost:8090/lpt1'},
      {
        url: 'example.com/foo .js',
        raw: 'example.com/foo%20.js',
        encoded: 'example.com/foo%2520.js',
      },
      {
        url: 'example.com///foo.js',
        raw: 'example.com/foo.js',
        encoded: 'example.com/foo.js',
      },
      {
        url: 'example.com///',
        raw: 'example.com/index.html',
        encoded: 'example.com/index.html',
      },
      // Very long file names.
      {
        url: 'example.com' +
            '/THIS/PATH/IS_MORE_THAN/200/Chars'.repeat(8),
        raw: 'example.com/longurls/Chars-141a715a',
        encoded: 'example.com/longurls/Chars-141a715a',
      },
      {
        url: ('example.com' +
              '/THIS/PATH/IS_LESS_THAN/200/Chars'.repeat(5))
                 .slice(0, -1),
        raw:
            'example.com/THIS/PATH/IS_LESS_THAN/200/Chars/THIS/PATH/IS_LESS_THAN/200/Chars/THIS/PATH/IS_LESS_THAN/200/Chars/THIS/PATH/IS_LESS_THAN/200/Chars/THIS/PATH/IS_LESS_THAN/200/Char',
        encoded:
            'example.com/THIS/PATH/IS_LESS_THAN/200/Chars/THIS/PATH/IS_LESS_THAN/200/Chars/THIS/PATH/IS_LESS_THAN/200/Chars/THIS/PATH/IS_LESS_THAN/200/Chars/THIS/PATH/IS_LESS_THAN/200/Char',
      },
    ];
    if (Host.Platform.isWin()) {
      toTest = [
        {
          url: 'https://www.example.com/?foo=bar',
          raw: 'www.example.com/%3Ffoo=bar',
          encoded: 'www.example.com/%253Ffoo=bar',
        },
        {
          url: 'http://www.web.dev/path/page.html#anchor',
          raw: 'www.web.dev/path/page.html',
          encoded: 'www.web.dev/path/page.html',
        },
        {
          url: 'http://www.example.com/?foo=bar/',
          raw: 'www.example.com/%3Ffoo=bar%2F',
          encoded: 'www.example.com/%253Ffoo=bar%252F',
        },
        {
          url: 'http://www.example.com/?foo=bar?',
          raw: 'www.example.com/%3Ffoo=bar%3F',
          encoded: 'www.example.com/%253Ffoo=bar%253F',
        },
        {
          url: 'http://www.example.com/file&$*?.html',
          raw: 'www.example.com/file&$%2A%3F.html',
          encoded: 'www.example.com/file&$%252A%253F.html',
        },
        {
          url: 'localhost:8090/',
          raw: 'localhost%3A8090/index.html',
          encoded: 'localhost%253A8090/index.html',
        },
        // Windows cannot end with . (period) and space.
        {
          url: 'example.com/foo.js.',
          raw: 'example.com/foo.js%2E',
          encoded: 'example.com/foo.js%252E',
        },
        {
          url: 'localhost:8090/endswith.',
          raw: 'localhost%3A8090/endswith%2E',
          encoded: 'localhost%253A8090/endswith%252E',
        },
        {
          url: 'example.com/foo.js ',
          raw: 'example.com/foo.js%20',
          encoded: 'example.com/foo.js%2520',
        },
        // Reserved filenames on Windows.
        {
          url: 'example.com/CON',
          raw: 'example.com/%43%4F%4E',
          encoded: 'example.com/%2543%254F%254E',
        },
        {
          url: 'example.com/cOn',
          raw: 'example.com/%63%4F%6E',
          encoded: 'example.com/%2563%254F%256E',
        },
        {
          url: 'example.com/cOn/hello',
          raw: 'example.com/%63%4F%6E/hello',
          encoded: 'example.com/%2563%254F%256E/hello',
        },
        {
          url: 'example.com/PRN',
          raw: 'example.com/%50%52%4E',
          encoded: 'example.com/%2550%2552%254E',
        },
        {
          url: 'example.com/AUX',
          raw: 'example.com/%41%55%58',
          encoded: 'example.com/%2541%2555%2558',
        },
        {
          url: 'example.com/NUL',
          raw: 'example.com/%4E%55%4C',
          encoded: 'example.com/%254E%2555%254C',
        },
        {
          url: 'example.com/COM1',
          raw: 'example.com/%43%4F%4D%31',
          encoded: 'example.com/%2543%254F%254D%2531',
        },
        {
          url: 'example.com/COM2',
          raw: 'example.com/%43%4F%4D%32',
          encoded: 'example.com/%2543%254F%254D%2532',
        },
        {
          url: 'example.com/COM3',
          raw: 'example.com/%43%4F%4D%33',
          encoded: 'example.com/%2543%254F%254D%2533',
        },
        {
          url: 'example.com/COM4',
          raw: 'example.com/%43%4F%4D%34',
          encoded: 'example.com/%2543%254F%254D%2534',
        },
        {
          url: 'example.com/COM5',
          raw: 'example.com/%43%4F%4D%35',
          encoded: 'example.com/%2543%254F%254D%2535',
        },
        {
          url: 'example.com/COM6',
          raw: 'example.com/%43%4F%4D%36',
          encoded: 'example.com/%2543%254F%254D%2536',
        },
        {
          url: 'example.com/COM7',
          raw: 'example.com/%43%4F%4D%37',
          encoded: 'example.com/%2543%254F%254D%2537',
        },
        {
          url: 'example.com/COM8',
          raw: 'example.com/%43%4F%4D%38',
          encoded: 'example.com/%2543%254F%254D%2538',
        },
        {
          url: 'example.com/COM9',
          raw: 'example.com/%43%4F%4D%39',
          encoded: 'example.com/%2543%254F%254D%2539',
        },
        {
          url: 'localhost:8090/lpt1',
          raw: 'localhost%3A8090/%6C%70%74%31',
          encoded: 'localhost%253A8090/%256C%2570%2574%2531',
        },
        {
          url: 'example.com/LPT1',
          raw: 'example.com/%4C%50%54%31',
          encoded: 'example.com/%254C%2550%2554%2531',
        },
        {
          url: 'example.com/LPT2',
          raw: 'example.com/%4C%50%54%32',
          encoded: 'example.com/%254C%2550%2554%2532',
        },
        {
          url: 'example.com/LPT3',
          raw: 'example.com/%4C%50%54%33',
          encoded: 'example.com/%254C%2550%2554%2533',
        },
        {
          url: 'example.com/LPT4',
          raw: 'example.com/%4C%50%54%34',
          encoded: 'example.com/%254C%2550%2554%2534',
        },
        {
          url: 'example.com/LPT5',
          raw: 'example.com/%4C%50%54%35',
          encoded: 'example.com/%254C%2550%2554%2535',
        },
        {
          url: 'example.com/LPT6',
          raw: 'example.com/%4C%50%54%36',
          encoded: 'example.com/%254C%2550%2554%2536',
        },
        {
          url: 'example.com/LPT7',
          raw: 'example.com/%4C%50%54%37',
          encoded: 'example.com/%254C%2550%2554%2537',
        },
        {
          url: 'example.com/LPT8',
          raw: 'example.com/%4C%50%54%38',
          encoded: 'example.com/%254C%2550%2554%2538',
        },
        {
          url: 'example.com/LPT9',
          raw: 'example.com/%4C%50%54%39',
          encoded: 'example.com/%254C%2550%2554%2539',
        },

      ];
    }
    toTest.forEach(testStrings => {
      assert.deepEqual(
          networkPersistenceManager.rawPathFromUrl(testStrings.url as Platform.DevToolsPath.UrlString),
          testStrings.raw);
      assert.deepEqual(
          networkPersistenceManager.encodedPathFromUrl(testStrings.url as Platform.DevToolsPath.UrlString),
          testStrings.encoded);
    });
  });
});

describe('NetworkPersistenceManager', () => {
  before(async () => {
    await initializeGlobalVars();
  });
  after(async () => {
    await deinitializeGlobalVars();
  });

  it('escapes patterns to be used in RegExes', () => {
    assert.strictEqual(Persistence.NetworkPersistenceManager.escapeRegex('www.example.com/'), 'www\\.example\\.com/');
    assert.strictEqual(
        Persistence.NetworkPersistenceManager.escapeRegex('www.example.com/index.html'),
        'www\\.example\\.com/index\\.html');
    assert.strictEqual(
        Persistence.NetworkPersistenceManager.escapeRegex('www.example.com/*'), 'www\\.example\\.com/.*');
    assert.strictEqual(
        Persistence.NetworkPersistenceManager.escapeRegex('www.example.com/*.js'), 'www\\.example\\.com/.*\\.js');
    assert.strictEqual(
        Persistence.NetworkPersistenceManager.escapeRegex('www.example.com/file([{with-special$_^chars}])'),
        'www\\.example\\.com/file\\(\\[\\{with\\-special\\$_\\^chars\\}\\]\\)');
    assert.strictEqual(
        Persistence.NetworkPersistenceManager.escapeRegex('www.example.com/page.html?foo=bar'),
        'www\\.example\\.com/page\\.html\\?foo=bar');
    assert.strictEqual(
        Persistence.NetworkPersistenceManager.escapeRegex('www.example.com/*?foo=bar'),
        'www\\.example\\.com/.*\\?foo=bar');
  });

  it('detects when the tail of a path matches with a default index file', () => {
    assert.deepEqual(
        Persistence.NetworkPersistenceManager.extractDirectoryIndex('index.html'), {head: '', tail: 'index.html'});
    assert.deepEqual(
        Persistence.NetworkPersistenceManager.extractDirectoryIndex('index.htm'), {head: '', tail: 'index.htm'});
    assert.deepEqual(
        Persistence.NetworkPersistenceManager.extractDirectoryIndex('index.php'), {head: '', tail: 'index.php'});
    assert.deepEqual(Persistence.NetworkPersistenceManager.extractDirectoryIndex('index.ht'), {head: 'index.ht'});
    assert.deepEqual(Persistence.NetworkPersistenceManager.extractDirectoryIndex('*.html'), {head: '', tail: '*.html'});
    assert.deepEqual(Persistence.NetworkPersistenceManager.extractDirectoryIndex('*.htm'), {head: '', tail: '*.htm'});
    assert.deepEqual(
        Persistence.NetworkPersistenceManager.extractDirectoryIndex('path/*.html'), {head: 'path/', tail: '*.html'});
    assert.deepEqual(Persistence.NetworkPersistenceManager.extractDirectoryIndex('foo*.html'), {head: 'foo*.html'});
    assert.deepEqual(Persistence.NetworkPersistenceManager.extractDirectoryIndex('a*'), {head: 'a*'});
    assert.deepEqual(Persistence.NetworkPersistenceManager.extractDirectoryIndex('a/*'), {head: 'a/', tail: '*'});
  });

  it('merges headers which do not overlap', async () => {
    const {networkPersistenceManager} = await setUpEnvironment();
    const baseHeaders = [{
      name: 'age',
      value: '0',
    }];
    const overrideHeaders = {
      'accept-ranges': 'bytes',
    };
    const merged = [
      {name: 'age', value: '0'},
      {name: 'accept-ranges', value: 'bytes'},
    ];
    assert.deepEqual(networkPersistenceManager.mergeHeaders(baseHeaders, overrideHeaders), merged);
  });

  it('merges headers which overlap', async () => {
    const {networkPersistenceManager} = await setUpEnvironment();
    const baseHeaders = [{
      name: 'age',
      value: '0',
    }];
    const overrideHeaders = {
      'accept-ranges': 'bytes',
      'age': '1',
    };
    const merged = [
      {name: 'age', value: '1'},
      {name: 'accept-ranges', value: 'bytes'},
    ];
    assert.deepEqual(networkPersistenceManager.mergeHeaders(baseHeaders, overrideHeaders), merged);
  });

  it('generates header patterns', async () => {
    const {networkPersistenceManager} = await setUpEnvironment();
    const headers = `[
      {
        "applyTo": "*",
        "headers": {
          "age": "0"
        }
      },
      {
        "applyTo": "page.html",
        "headers": {
          "age": "1"
        }
      },
      {
        "applyTo": "index.html",
        "headers": {
          "age": "2"
        }
      },
      {
        "applyTo": "nested/path/*.js",
        "headers": {
          "age": "3"
        }
      },
      {
        "applyTo": "*/path/*.js",
        "headers": {
          "age": "4"
        }
      }
    ]`;

    const {uiSourceCode} = createFileSystemUISourceCode({
      url: 'file:///path/to/overrides/www.example.com/.headers' as Platform.DevToolsPath.UrlString,
      content: headers,
      mimeType: 'text/plain',
      fileSystemPath: 'file:///path/to/overrides',
    });

    const expectedPatterns = [
      'http?://www.example.com/*',
      'http?://www.example.com/page.html',
      'http?://www.example.com/index.html',
      'http?://www.example.com/',
      'http?://www.example.com/nested/path/*.js',
      'http?://www.example.com/*/path/*.js',
    ];

    const {headerPatterns, path, overridesWithRegex} =
        await networkPersistenceManager.generateHeaderPatterns(uiSourceCode);
    assert.deepEqual(Array.from(headerPatterns).sort(), expectedPatterns.sort());

    const expectedMapping = [
      {
        applyTo: /^https?:\/\/www\.example\.com\/(.*)?$/.toString(),
        headers: {age: '0'},
      },
      {
        applyTo: /^https?:\/\/www\.example\.com\/page\.html$/.toString(),
        headers: {age: '1'},
      },
      {
        applyTo: /^https?:\/\/www\.example\.com\/(index\.html)?$/.toString(),
        headers: {age: '2'},
      },
      {
        applyTo: /^https?:\/\/www\.example\.com\/nested\/path\/.*\.js$/.toString(),
        headers: {age: '3'},
      },
      {
        applyTo: /^https?:\/\/www\.example\.com\/.*\/path\/.*\.js$/.toString(),
        headers: {age: '4'},
      },
    ];

    assert.strictEqual(path, 'www.example.com/');
    const actualMapping = overridesWithRegex.map(
        override => ({applyTo: override.applyToRegex.toString(), headers: override.headers}),
    );
    assert.deepEqual(actualMapping, expectedMapping);
  });
});
