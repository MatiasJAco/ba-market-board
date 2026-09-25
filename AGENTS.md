# Agent rules

This repo is Spec-Driven Development. Spec Kit artifacts are source of truth.
Do not implement features that are not in the current spec / plan / tasks.

## Order
1. constitution → specify → clarify → plan → tasks
2. implement one task
3. @tester
4. if fail, @coder on that task only
5. /speckit-converge when all tasks are done

## Roles
- Tab Plan or @planner for design
- Tab Build + @coder for implementation
- @tester after every task
- Never mix coder and tester in one prompt

## Product constraints
- One simple web page
- Buenos Aires current weather
- Top 5 CEDEAR prices
- Argentine peso vs USD (official vs blue decided in the spec)
- Free public APIs only, no secrets in git
- Tests required before a task is done
