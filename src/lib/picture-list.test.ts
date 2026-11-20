import { describe, expect, it } from "vitest";
import { MAX_PICTURES, PICTURE_MAX_BYTES, makeMain, movePicture, orderIds, pickPictures, roomFor } from "./picture-list";

const file = (name: string, type = "image/jpeg", size = 1000) => ({ name, type, size });

describe("movePicture", () => {
  const list = ["a", "b", "c", "d"];
  it("moves one picture and keeps the rest in order", () => {
    expect(movePicture(list, 0, 1)).toEqual(["b", "a", "c", "d"]);
    expect(movePicture(list, 3, 1)).toEqual(["a", "d", "b", "c"]);
  });
  it("clamps at the ends and never changes the original", () => {
    expect(movePicture(list, 0, -1)).toEqual(list);
    expect(movePicture(list, 3, 9)).toEqual(list);
    expect(movePicture(list, 7, 0)).toEqual(list);
    expect(list).toEqual(["a", "b", "c", "d"]);
  });
  it("makes a picture the main one by moving it first", () => {
    expect(makeMain(list, 2)).toEqual(["c", "a", "b", "d"]);
    expect(makeMain(list, 0)).toEqual(list);
  });
});

describe("pickPictures", () => {
  it("accepts JPEG, PNG and WebP up to 5 MB, in the order chosen", () => {
    const { accepted, refused } = pickPictures([file("1.jpg"), file("2.png", "image/png"), file("3.webp", "image/webp")], 0);
    expect(accepted.map((f) => f.name)).toEqual(["1.jpg", "2.png", "3.webp"]);
    expect(refused).toEqual([]);
  });
  it("refuses other types and files over 5 MB", () => {
    const { accepted, refused } = pickPictures([file("a.gif", "image/gif"), file("b.jpg", "image/jpeg", PICTURE_MAX_BYTES + 1), file("c.jpg")], 0);
    expect(accepted.map((f) => f.name)).toEqual(["c.jpg"]);
    expect(refused.map((r) => [r.file.name, r.problem])).toEqual([["a.gif", "type"], ["b.jpg", "size"]]);
  });
  it("stops at five pictures, counting the ones already there", () => {
    const { accepted, refused } = pickPictures([file("1.jpg"), file("2.jpg"), file("3.jpg")], 3);
    expect(accepted.map((f) => f.name)).toEqual(["1.jpg", "2.jpg"]);
    expect(refused.map((r) => [r.file.name, r.problem])).toEqual([["3.jpg", "full"]]);
    expect(pickPictures([file("6.jpg")], MAX_PICTURES).refused[0]!.problem).toBe("full");
  });
});

describe("roomFor and orderIds", () => {
  it("counts the room left", () => {
    expect(roomFor(0)).toBe(5);
    expect(roomFor(4)).toBe(1);
    expect(roomFor(5)).toBe(0);
    expect(roomFor(7)).toBe(0);
  });
  it("sends only saved pictures' ids, in order", () => {
    expect(orderIds([{ id: "b" }, { id: undefined }, { id: "a" }])).toEqual(["b", "a"]);
  });
});
