// Copyright (c) 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import '../../legacy/legacy.js'; // Required for <x-link>.

import * as ComponentHelpers from '../../components/helpers/helpers.js';
import * as LitHtml from '../../lit-html/lit-html.js';

import {getMarkdownLink} from './MarkdownLinksMap.js';

export interface MarkdownLinkData {
  key: string;
  title: string;
}

/**
 * Component to render link from parsed markdown.
 * Parsed links from markdown are not directly rendered, instead they have to be added to the <key, link> map in MarkdownLinksMap.ts.
 * This makes sure that all links are accounted for and no bad links are introduced to devtools via markdown.
 */
export class MarkdownLink extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-markdown-link`;

  private readonly shadow = this.attachShadow({mode: 'open'});
  private linkText: string = '';
  private linkUrl: string = '';

  set data(data: MarkdownLinkData) {
    const {key, title} = data;
    const markdownLink = getMarkdownLink(key);
    this.linkText = title;
    this.linkUrl = markdownLink;
    this.render();
  }

  private render(): void {
    // clang-format off
    // eslint-disable-next-line rulesdir/ban_style_tags_in_lit_html
    const output = LitHtml.html`
      <style>
        .devtools-link {
          color: var(--color-link);
          text-decoration: none;
        }

        .devtools-link:hover {
          text-decoration: underline;
        }
      </style>
      <x-link class="devtools-link" href=${this.linkUrl}>${this.linkText}</x-link>
    `;
    LitHtml.render(output, this.shadow);
    // clang-format on
  }
}

ComponentHelpers.CustomElements.defineComponent('devtools-markdown-link', MarkdownLink);

declare global {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface HTMLElementTagNameMap {
    'devtools-markdown-link': MarkdownLink;
  }
}
