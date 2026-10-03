import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Modifier, VectorObject } from '@vector-editor/core';
import { MirrorModifierFields, MirrorModifierPatch } from './mirror-modifier-fields';

type MirrorModifier = Extract<Modifier, { type: 'mirror' }>;

describe('MirrorModifierFields', () => {
  let fixture: ComponentFixture<MirrorModifierFields>;
  let modifier: MirrorModifier;
  let committed: MirrorModifierPatch[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MirrorModifierFields],
    }).compileComponents();

    fixture = TestBed.createComponent(MirrorModifierFields);
    modifier = { id: 'mirror', type: 'mirror', axis: 'x', enabled: true };
    committed = [];
    fixture.componentRef.setInput('modifier', modifier);
    fixture.componentRef.setInput('emptyPoints', [] satisfies readonly VectorObject[]);
    fixture.componentInstance.committed.subscribe((patch) => committed.push(patch));
    fixture.detectChanges();
  });

  it('toggles X and Y independently and permits both axes to be off', () => {
    button('X').click();
    expect(committed.at(-1)).toEqual({ axis: 'none' });
    setAxis(committed.at(-1)!.axis!);

    button('Y').click();
    expect(committed.at(-1)).toEqual({ axis: 'y' });
    setAxis(committed.at(-1)!.axis!);

    button('X').click();
    expect(committed.at(-1)).toEqual({ axis: 'xy' });
    setAxis(committed.at(-1)!.axis!);

    button('Y').click();
    expect(committed.at(-1)).toEqual({ axis: 'x' });
    setAxis(committed.at(-1)!.axis!);

    button('X').click();
    expect(committed.at(-1)).toEqual({ axis: 'none' });
  });

  function setAxis(axis: MirrorModifier['axis']): void {
    modifier = { ...modifier, axis };
    fixture.componentRef.setInput('modifier', modifier);
    fixture.detectChanges();
  }

  function button(label: string): HTMLButtonElement {
    const match = [...fixture.nativeElement.querySelectorAll('button')].find(
      (item): item is HTMLButtonElement =>
        item instanceof HTMLButtonElement && item.textContent?.trim() === label,
    );
    if (!match) {
      throw new Error(`${label} axis button is missing`);
    }
    return match;
  }
});
