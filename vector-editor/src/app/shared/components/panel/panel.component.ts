import { Component, computed, input } from '@angular/core';

@Component({
  standalone: false,
  selector: 'panel',
  styleUrl: './panel.component.scss',
  templateUrl: './panel.component.html',
})
export class PanelComponent {
  public readonly panelName = input.required<string>();

  public readonly label = computed(() => this.panelName().toLocaleLowerCase().replace(' ', '-'));
}
