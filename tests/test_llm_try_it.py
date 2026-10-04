from app.llm.schemas import Draft, DraftInput
from app.llm.try_it import main


def test_try_it_prints_draft_and_provider(tmp_path, monkeypatch, capsys) -> None:
    async def fake(inp: DraftInput, **kwargs: object) -> Draft:
        assert inp.items == ["butter chicken"]
        return Draft(text="I had butter chicken.", provider="template", grounding_ok=True)

    monkeypatch.setattr("app.llm.try_it.draft_review", fake)
    path = tmp_path / "sample.json"
    path.write_text(DraftInput(items=["butter chicken"], ratings={"food": 4}).model_dump_json(), encoding="utf-8")
    assert main([str(path)]) == 0
    output = capsys.readouterr().out
    assert "I had butter chicken." in output
    assert "provider: template" in output
