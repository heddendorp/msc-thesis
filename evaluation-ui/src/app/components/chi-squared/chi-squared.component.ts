import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  bignumber,
  chain,
  divide,
  factorial,
  gamma,
  multiply,
  pow,
  subtract,
  sum,
} from 'mathjs';

@Component({
  selector: 'app-chi-squared',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chi-squared.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChiSquaredComponent implements OnChanges {
  @Input() a: number | null = 0;
  @Input() b: number | null = 0;
  @Input() c: number | null = 0;
  @Input() d: number | null = 0;
  n = 0;
  chiSquared = 0;
  criticalValue = 3.84145882;
  reject = false;

  ngOnChanges() {
    if (
      this.a === null ||
      this.b === null ||
      this.c === null ||
      this.d === null
    ) {
      return;
    }
    this.n = this.a + this.b + this.c + this.d;
    const expectedA = divide(
      multiply(this.a + this.b, this.a + this.c),
      this.n
    );
    const expectedB = divide(
      multiply(this.a + this.b, this.b + this.d),
      this.n
    );
    const expectedC = divide(
      multiply(this.c + this.d, this.a + this.c),
      this.n
    );
    const expectedD = divide(
      multiply(this.c + this.d, this.b + this.d),
      this.n
    );

    this.chiSquared = Number(
      chain(divide(pow(subtract(this.a, expectedA), 2), expectedA))
        .add(divide(pow(subtract(this.b, expectedB), 2), expectedB))
        .add(divide(pow(subtract(this.c, expectedC), 2), expectedC))
        .add(divide(pow(subtract(this.d, expectedD), 2), expectedD))
        .done()
        .toString()
    );
    this.reject = this.chiSquared > this.criticalValue;
  }
}
