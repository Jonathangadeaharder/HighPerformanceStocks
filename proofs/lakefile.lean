import Lake
open Lake DSL

package «hps-proofs» where
  leanOptions := #[
    ⟨`autoImplicit, false⟩
  ]

@[default_target]
lean_lib «InvestmentModel» where
  srcDir := "."
