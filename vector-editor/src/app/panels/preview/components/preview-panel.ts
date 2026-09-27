import { Component } from '@angular/core';

@Component({
  selector: 'app-preview-panel',
  template: `
    <section class="panel-section" aria-labelledby="preview-heading">
      <h2 id="preview-heading">Preview</h2>
      <p>Nothing to preview.</p>
    </section>
  `,
})
export class PreviewPanel {}
